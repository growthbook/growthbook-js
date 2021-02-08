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
    this.runAutoExperiments();
  }

  setAttributes(attributes: UserAttributes, merge: boolean = false) {
    if (merge) {
      Object.assign(this.attributes, attributes);
    } else {
      this.attributes = attributes;
    }

    this.updateAttributeMap();
    return this;
  }

  runAutoExperiments() {
    // Only in browser environment
    if(typeof window === "undefined") return;

    this.client.experiments.forEach(exp => {
      // Must be marked as auto, targeting based on url, and have variation info
      if(exp.auto && exp.url && exp.variationInfo) {
        // Must define either dom or css changes for at least 1 variation
        if(exp.variationInfo.filter(v=>v.dom || v.css).length > 0) {
          // Put user in experiment and apply any dom/css mods
          const {apply} = this.experiment(exp);
          apply();
        }
      }
    });
  }

  private isIncluded(experiment: Experiment): boolean {
    if(experiment.variations < 2) return false;

    if(experiment.status === "draft") return false;

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

  private getExperimentResults(experiment?: Experiment, variation: number = -1): ExperimentResults {
    return {
      variation,
      experiment,
      data: experiment ? this.getVariationData(experiment, variation) : undefined,
      apply: variation >= 0 ? () => {
        const info = experiment?.variationInfo?.[variation];
        if(info && (info.dom || info.css)) {
          applyDomMods({
            dom: info.dom,
            css: info.css
          });
        }
      }: () => {
        // do nothing if not in experiment
      }
    };
  }

  experiment(experiment: string|Experiment): ExperimentResults {
    if(typeof experiment === "string") {
      experiment = this.client.experiments.filter(e=>e.key===experiment)[0];
      if(!experiment) {
        return this.getExperimentResults();
      }
    }

    // Experiments turned off globally
    if(!this.client.config.enabled) return this.getExperimentResults(experiment);

    // If querystring override is enabled
    if (this.client.config.enableQueryStringOverride) {
      let override = getQueryStringOverride(experiment.key, this.client);
      if (override !== null) {
        return this.getExperimentResults(experiment, override);
      }
    }

    if(!this.isIncluded(experiment)) {
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
        if(exp.variationInfo && exp.variationInfo.filter(v=>v.data && v.data[key]).length>0) {
          const ret = this.experiment(exp);
          if(ret.variation >= 0) {
            return {
              experiment: exp,
              variation: ret.variation,
              value: ret.data?.[key],
            }
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
    if(experiment.variationInfo?.[variation]) {
      return experiment.variationInfo[variation].data || {};
    }
    // Fall back to using the data from control
    return experiment.variationInfo?.[0]?.data || {}
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
    if (variation !== -1 && !this.experimentsTracked.has(userId + experiment.key)) {
      this.experimentsTracked.add(userId + experiment.key);

      if (this.client.config.onExperimentViewed) {
        const variationKey = experiment.variationInfo?.[variation]?.key || ""+variation;

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
