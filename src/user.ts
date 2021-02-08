import {
  UserAttributes,
  VariationData,
  Experiment,
  ExperimentResults,
  DataLookupResults,
} from './types';
import {
  checkRule,
  getWeightsFromOptions,
  chooseVariation,
  getQueryStringOverride,
  applyDomMods,
  urlIsValid,
} from './util';
import GrowthBookClient from 'client';

export default class GrowthBookUser {
  private id: string;
  private anonId: string;
  private attributes: UserAttributes;
  private client: GrowthBookClient;
  private experimentsTracked: Set<string>;
  private attributeMap: Map<string, string>;
  private activeExperiments: ExperimentResults[] = [];

  constructor(
    id: string,
    anonId: string,
    attributes: UserAttributes = {},
    client: GrowthBookClient
  ) {
    this.id = id;
    this.anonId = anonId;
    this.attributes = attributes;
    this.client = client;

    this.experimentsTracked = new Set();
    this.attributeMap = new Map();
    this.updateAttributeMap();
    this.refreshActiveExperiments();
  }

  setAttributes(attributes: UserAttributes, merge: boolean = false) {
    if (merge) {
      Object.assign(this.attributes, attributes);
    } else {
      this.attributes = attributes;
    }

    this.updateAttributeMap();
    this.refreshActiveExperiments();
    return this;
  }

  destroy() {
    // Deactivate any active experiments and cleanup for GC
    this.activeExperiments.forEach(exp => exp.deactivate());
    this.activeExperiments = [];

    // Remove user from client
    const index = this.client.users.indexOf(this);
    if (index !== -1) {
      this.client.users.splice(index, 1);
    }
  }

  getActiveExperiments() {
    return this.activeExperiments;
  }

  refreshActiveExperiments() {
    // Only in browser environment
    if (typeof window === 'undefined') return;

    // First see if any currently active experiments need to be deactivated
    const activeIds: Set<string> = new Set();
    this.activeExperiments.forEach(res => {
      if (!res.experiment || res.variation === -1) return;

      const newRes = this.experiment(res.experiment);
      if (newRes.variation === -1) {
        // Remove any dom/css changes and remove from active list
        res.deactivate();
      } else {
        activeIds.add(res.experiment.key);
      }
    });

    // Then, add in any new experiments
    this.client.experiments.forEach(exp => {
      // Skip ones that have already been activated
      if (activeIds.has(exp.key)) return;

      // Must be marked as auto, targeting based on url, and have variation info
      if (!exp.auto || !exp.url || !exp.variationInfo) return;

      // Put user in experiment and apply any dom/css mods
      const res = this.experiment(exp);
      res.activate();
    });
  }

  private isIncluded(experiment: Experiment): boolean {
    if (experiment.variations < 2) return false;

    if (experiment.status === 'draft') return false;

    // Missing required type of user id
    const userId = experiment?.anon ? this.anonId : this.id;
    if (!userId) {
      return false;
    }

    // Experiment has targeting rules, check if user matches
    if (experiment.targeting && !this.isTargeted(experiment.targeting)) {
      return false;
    }

    // URL targeting
    if (experiment.url && !urlIsValid(experiment.url, this.client)) {
      return false;
    }

    return true;
  }

  private getExperimentResults(
    experiment?: Experiment,
    variation: number = -1
  ): ExperimentResults {
    let revert: () => void;

    const res = {
      variation,
      experiment,
      data: experiment
        ? this.getVariationData(experiment, variation)
        : undefined,
      activate:
        variation >= 0
          ? () => {
              // Ignore if already active
              if (this.activeExperiments.includes(res)) return;

              // Add to active list
              this.activeExperiments.push(res);

              const info = experiment?.variationInfo?.[variation];

              if (info?.activate) {
                info.activate();
              }
              if (info?.dom || info?.css) {
                revert = applyDomMods({
                  dom: info.dom,
                  css: info.css,
                });
              }
            }
          : () => {
              // do nothing if not in experiment
            },
      deactivate: () => {
        // Unapply dom/css changes
        revert && revert();

        // Undo custom changes
        const deactivate = experiment?.variationInfo?.[variation]?.deactivate;
        deactivate && deactivate();

        // Remove from active list
        const index = this.activeExperiments.indexOf(res);
        if (index !== -1) {
          this.activeExperiments.splice(index, 1);
        }
      },
    };
    return res;
  }

  experiment(experiment: string | Experiment): ExperimentResults {
    if (typeof experiment === 'string') {
      experiment = this.client.experiments.filter(e => e.key === experiment)[0];
      if (!experiment) {
        return this.getExperimentResults();
      }
    }

    // Experiments turned off globally
    if (!this.client.config.enabled) {
      return this.getExperimentResults(experiment);
    }

    // If querystring override is enabled
    if (this.client.config.enableQueryStringOverride) {
      let override = getQueryStringOverride(experiment.key, this.client);
      if (override !== null) {
        return this.getExperimentResults(experiment, override);
      }
    }

    if (!this.isIncluded(experiment)) {
      return this.getExperimentResults(experiment);
    }

    // Experiment variation is forced
    if (experiment.force !== undefined && experiment.force !== null) {
      return this.getExperimentResults(experiment, experiment.force);
    }

    const weights = getWeightsFromOptions(experiment);

    const userId = experiment?.anon ? this.anonId : this.id;

    // Hash unique id and experiment id to randomly choose a variation given weights
    const variation = chooseVariation(userId, experiment.key, weights);
    this.trackView(experiment, variation, userId, experiment.anon);

    return this.getExperimentResults(experiment, variation);
  }

  lookupByDataKey(key: string): DataLookupResults {
    if (this.client.experiments) {
      for (let i = 0; i < this.client.experiments.length; i++) {
        const exp = this.client.experiments[i];
        if (
          exp.variationInfo &&
          exp.variationInfo.filter(v => v.data && v.data[key]).length > 0
        ) {
          const ret = this.experiment(exp);
          if (ret.variation >= 0) {
            return {
              experiment: exp,
              variation: ret.variation,
              value: ret.data?.[key],
            };
          }
        }
      }
    }

    return {};
  }

  private getVariationData(
    experiment: Experiment,
    variation: number
  ): VariationData {
    if (experiment.variationInfo?.[variation]) {
      return experiment.variationInfo[variation].data || {};
    }
    // Fall back to using the data from control
    return experiment.variationInfo?.[0]?.data || {};
  }

  private isTargeted(rules: string[]): boolean {
    for (let i = 0; i < rules.length; i++) {
      const parts = rules[i].split(' ', 3);
      if (
        !checkRule(
          this.attributeMap.get(parts[0]) || '',
          parts[1] || '',
          parts[2].trim() || ''
        )
      ) {
        return false;
      }
    }
    return true;
  }

  private flattenUserValues(prefix: string, val: any) {
    if (val && typeof val === 'object') {
      let ret: { k: string; v: string }[] = [];
      Object.keys(val).forEach(key => {
        ret = ret.concat(
          this.flattenUserValues(prefix ? `${prefix}.${key}` : key, val[key])
        );
      });
      return ret;
    }
    return [{ k: prefix, v: '' + val }];
  }
  private updateAttributeMap() {
    this.attributeMap.clear();
    this.flattenUserValues('', this.attributes).forEach(({ k, v }) => {
      this.attributeMap.set(k, v);
    });
  }

  private trackView(
    experiment: Experiment,
    variation: number,
    userId: string,
    anon?: boolean
  ) {
    // Only track an experiment once per user/test
    if (
      variation !== -1 &&
      !this.experimentsTracked.has(userId + experiment.key)
    ) {
      this.experimentsTracked.add(userId + experiment.key);

      if (this.client.config.onExperimentViewed) {
        const variationKey =
          experiment.variationInfo?.[variation]?.key || '' + variation;

        this.client.config.onExperimentViewed({
          experiment,
          variation,
          variationKey,
          data: this.getVariationData(experiment, variation),
          [anon ? 'anonId' : 'userId']: userId,
          userAttributes: this.attributes,
        });
      }
    }
  }
}
