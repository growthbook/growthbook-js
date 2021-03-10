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

  getAttributes(): UserAttributes {
    return this.attributes;
  }

  deactivateAllExperiments() {
    // Deactivate any active experiments and cleanup for GC
    this.activeExperiments.forEach(exp => exp.deactivate());
    this.activeExperiments = [];
  }

  destroy() {
    this.deactivateAllExperiments();

    // Remove user from client
    const index = this.client.users.indexOf(this);
    if (index !== -1) {
      this.client.users.splice(index, 1);
    }
  }

  refreshActiveExperiments() {
    // Only in browser environment
    if (typeof window === 'undefined') return;

    this.log('Refreshing active experiments');

    // First see if any currently active experiments need to be deactivated
    const activeIds: Set<string> = new Set();
    const deactivatedIds: Set<string> = new Set();
    this.activeExperiments.forEach(res => {
      if (!res.experiment || res.variation === -1) return;

      const newRes = this.runExperiment(res.experiment);
      if (newRes.variation === -1) {
        this.log(
          'No longer in experiment ' + res.experiment.key + ', deactivating'
        );
        // Remove any dom/css changes and remove from active list
        res.deactivate();
        deactivatedIds.add(res.experiment.key);
      } else {
        activeIds.add(res.experiment.key);
      }
    });

    // Then, add in any new experiments
    this.client.experiments.forEach(exp => {
      // Skip ones that have already been activated or were just deactivated
      if (activeIds.has(exp.key)) return;
      if (deactivatedIds.has(exp.key)) return;

      // Must be marked as auto, targeting based on url, and have variation info
      if (!exp.auto || !exp.url || !Array.isArray(exp.variations)) return;

      // Put user in experiment and apply any dom/css mods
      const res = this.runExperiment(exp);
      res.activate();
    });
  }

  private log(msg: string) {
    if (this.client.config.debug) {
      console.log(msg, {
        userId: this.id,
        anonId: this.anonId,
      });
    }
  }

  private isIncluded(experiment: Experiment): boolean {
    const numVariations = this.getNumVariations(experiment);
    if (numVariations < 2) {
      this.log(
        'variations must be at least 2, but only set to ' + numVariations
      );
      return false;
    }

    if (experiment.status === 'draft') {
      this.log('experiment in draft mode');
      return false;
    }

    if (experiment.status === 'stopped' && !('force' in experiment)) {
      this.log('experiment is stopped and no variation is forced');
      return false;
    }

    // Missing required type of user id
    const userId = experiment?.anon ? this.anonId : this.id;
    if (!userId) {
      this.log(
        'experiment requires ' +
          (experiment?.anon ? 'anonId' : 'userId') +
          ' to be set'
      );
      return false;
    }

    // Experiment has targeting rules, check if user matches
    if (experiment.targeting && !this.isTargeted(experiment.targeting)) {
      this.log('failed experiment targeting rules');
      return false;
    }

    // URL targeting
    if (experiment.url && !urlIsValid(experiment.url, this.client)) {
      this.log(
        'current url (' +
          this.client.config.url +
          ') does not match experiment url targeting'
      );
      return false;
    }

    return true;
  }

  private getExperimentResults(
    experiment?: Experiment,
    variation: number = -1
  ): ExperimentResults {
    let activate: () => void = () => {};
    let deactivate: () => void = () => {};

    if (variation >= 0 && experiment && Array.isArray(experiment.variations)) {
      const info = experiment.variations[variation];
      const key = experiment.key;
      let revert: () => void;
      activate = () => {
        // Ignore if already active
        if (this.activeExperiments.includes(res)) return;

        // Add to active list
        this.activeExperiments.push(res);

        if (info.activate) {
          this.log('Running custom activate function for ' + key);
          info.activate();
        }
        if (info.dom || info.css) {
          this.log('Applying DOM/CSS mods for ' + key);
          revert = applyDomMods({
            dom: info.dom,
            css: info.css,
          });
        }
      };
      deactivate = () => {
        if (revert) {
          this.log('Reverting DOM/CSS changes for ' + key);
          revert();
        }
        if (info.deactivate) {
          this.log('Running custom deactivate function for ' + key);
          info.deactivate();
        }

        // Remove from active list
        const index = this.activeExperiments.indexOf(res);
        if (index !== -1) {
          this.activeExperiments.splice(index, 1);
        }
      };
    }

    const res = {
      variation,
      experiment,
      data: experiment
        ? this.getVariationData(experiment, variation)
        : undefined,
      activate,
      deactivate,
    };
    return res;
  }

  private runExperiment(
    experiment: Experiment,
    isOverride: boolean = false
  ): ExperimentResults {
    this.log('Trying to put user in experiment ' + experiment.key);

    if (isOverride) {
      this.log('Using override experiment configs in client');
    }

    // Experiments turned off globally
    if (!this.client.isEnabled()) {
      this.log('client is not enabled, assigning variation -1');
      return this.getExperimentResults(experiment);
    }

    // If querystring override is enabled
    if (this.client.config.enableQueryStringOverride) {
      let override = getQueryStringOverride(experiment.key, this.client);
      if (override !== null) {
        this.log(
          'querystring override is present, assigning variation ' + override
        );
        return this.getExperimentResults(experiment, override);
      }
    }

    if (!this.isIncluded(experiment)) {
      this.log('not included in experiment, assigning variation -1');
      return this.getExperimentResults(experiment);
    }

    // Experiment variation is forced
    if (experiment.force !== undefined && experiment.force !== null) {
      this.log('variation forced to ' + experiment.force);
      return this.getExperimentResults(experiment, experiment.force);
    }

    const weights = getWeightsFromOptions(experiment);

    const userId = experiment?.anon ? this.anonId : this.id;

    // Hash unique id and experiment id to randomly choose a variation given weights
    const variation = chooseVariation(userId, experiment.key, weights);
    this.trackView(experiment, variation, userId, experiment.anon);

    this.log('user put in experiment, assigned variation ' + variation);

    return this.getExperimentResults(experiment, variation);
  }

  private getNumVariations(experiment: Experiment) {
    return Array.isArray(experiment.variations)
      ? experiment.variations.length
      : experiment.variations;
  }

  experiment(experiment: Experiment): ExperimentResults {
    // Look for overrides in the client
    const override = this.client.experiments
      .filter(e => e.key === experiment.key)
      .pop();
    if (override) {
      // Make sure override has same number of variations
      if (
        this.getNumVariations(experiment) === this.getNumVariations(override)
      ) {
        return this.runExperiment(override, true);
      }

      if (process.env.NODE_ENV !== 'production') {
        console.error(
          'Experiment override in client has a different number of variations from the inline definition - ' +
            experiment.key
        );
      }
    }

    return this.runExperiment(experiment);
  }

  getFeatureFlag<T = any>(key: string): DataLookupResults<T> {
    this.log('Looking up experiments that define data for ' + key);

    // Experiments turned off globally
    if (!this.client.isEnabled()) {
      this.log('client is not enabled, returning immediately');
      return {
        experiment: undefined,
        variation: undefined,
        value: undefined,
      };
    }

    if (this.client.experiments) {
      for (let i = 0; i < this.client.experiments.length; i++) {
        const exp = this.client.experiments[i];
        if (
          Array.isArray(exp.variations) &&
          exp.variations.filter(v => v.data && key in v.data).length > 0
        ) {
          const ret = this.runExperiment(exp);
          if (ret.variation >= 0) {
            if (ret.data && key in ret.data) {
              this.log('Using value from variation: ' + ret.data[key]);
              return {
                experiment: exp,
                variation: ret.variation,
                value: ret.data[key] as T,
              };
            } else {
              this.log('No value defined for variation');
              return {
                experiment: exp,
                variation: ret.variation,
                value: undefined,
              };
            }
          }
        }
      }
    }

    this.log('No experiments found for the data key');

    return {
      experiment: undefined,
      variation: undefined,
      value: undefined,
    };
  }

  private getVariationData(
    experiment: Experiment,
    variation: number
  ): VariationData {
    if (!Array.isArray(experiment.variations)) return {};
    // If user is not in the experiment, return the control data
    if (variation === -1) return experiment.variations[0]?.data || {};
    return experiment.variations[variation]?.data || {};
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
          (Array.isArray(experiment.variations)
            ? experiment.variations[variation]?.key
            : null) || '' + variation;

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
