import {
  UserAttributes,
  VariationData,
  AnalyticsWindow,
  ExperimentParams,
  ExperimentResults,
  ExperimentData,
  DataLookupResults,
} from './types';
import {
  checkRule,
  getWeightsFromOptions,
  chooseVariation,
  getQueryStringOverride,
} from './util';
import GrowthBookClient from 'client';

export default class GrowthBookUser {
  private id: string;
  private attributes: UserAttributes;
  private client: GrowthBookClient;
  private experimentsTracked: Set<string>;
  private attributeMap: Map<string, string>;

  constructor(
    id: string,
    attributes: UserAttributes = {},
    client: GrowthBookClient
  ) {
    this.id = id;
    this.attributes = attributes;
    this.client = client;

    this.experimentsTracked = new Set();
    this.attributeMap = new Map();
    this.updateAttributeMap();
  }

  setId(id: string) {
    this.id = id;
    return this;
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

  experiment(id: string, options?: ExperimentParams): ExperimentResults {
    const notInTest: ExperimentResults = {
      experiment: id,
      variation: -1,
      data: this.getVariationData(id, -1, options),
    };

    // If experiments are disabled globally or no userId set
    if (!this.client.config.enabled || !this.id) {
      return notInTest;
    }

    // If querystring override is enabled
    if (this.client.config.enableQueryStringOverride) {
      let override = getQueryStringOverride(id);
      if (override !== null) {
        return {
          experiment: id,
          variation: override,
          data: this.getVariationData(id, override, options),
        };
      }
    }

    // If experiment settings are overridden in config
    if (!options) options = {};
    let optionsClone = { ...options };
    if (this.client.experiments && id in this.client.experiments) {
      // Value is forced, return immediately
      const { force, ...overrides } = this.client.experiments[id];
      if (force !== undefined) {
        return {
          experiment: id,
          variation: force,
          data: this.getVariationData(id, force, options),
        };
      }
      Object.assign(optionsClone, overrides);
    }

    // Require the number of variations to be set
    if(!optionsClone.variations) {
      return notInTest;
    }

    // Experiment has targeting rules, check if user matches
    if (optionsClone.targeting && !this.isTargeted(optionsClone.targeting)) {
      return notInTest;
    }

    const weights = getWeightsFromOptions(optionsClone);

    // Hash unique id and experiment id to randomly choose a variation given weights
    const variation = chooseVariation(this.id, id, weights);
    const variationData = this.getVariationData(id, variation, options);
    this.trackView(id, variation, variationData);

    return {
      experiment: id,
      variation,
      data: variationData,
    };
  }

  lookupByDataKey(key: string): DataLookupResults {
    if (this.client.experiments) {
      const ids = Object.keys(this.client.experiments);
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        const exp = this.client.experiments[id];

        if (exp.data && exp.data[key]) {
          const ret = this.experiment(id);
          if (ret.variation >= 0) {
            return {
              experiment: id,
              variation: ret.variation,
              value: ret.data[key],
            };
          }
        }
      }
    }

    return {
      experiment: undefined,
      variation: undefined,
      value: undefined,
    };
  }

  private getVariationData(
    experiment: string,
    variation: number,
    inlineOptions?: ExperimentParams
  ): VariationData {
    let data: ExperimentData = {};

    if (this.client.experiments && experiment in this.client.experiments) {
      const override = this.client.experiments[experiment].data;
      if (override) {
        data = override;
      }
    }

    if (inlineOptions && inlineOptions.data) {
      data = inlineOptions.data;
    }

    const variationData: VariationData = {};
    Object.keys(data).forEach(k => {
      variationData[k] = data[k][variation] || data[k][0];
    });

    return variationData;
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
    experiment: string,
    variation: number,
    data?: VariationData
  ) {
    // Only track an experiment once per user/test
    if (
      variation !== -1 &&
      !this.experimentsTracked.has(this.id + experiment)
    ) {
      this.experimentsTracked.add(this.id + experiment);

      if (typeof window !== 'undefined') {
        const w = window as AnalyticsWindow;
        if (this.client.config.segment) {
          const t = w?.analytics?.track;
          if (t) {
            t('Experiment Viewed', {
              experiment_id: experiment,
              variation_id: variation,
            });
          }
        }
        if (this.client.config.ga) {
          const g = w?.ga;
          if (g && typeof g === 'function') {
            g(
              'set',
              `dimension${this.client.config.ga}`,
              experiment + ':' + variation
            );
            g('send', 'event', 'experiment', experiment, variation + '');
          }
        }
      }
      if (this.client.config.onExperimentViewed) {
        this.client.config.onExperimentViewed({
          experiment,
          variation,
          data,
          userId: this.id,
          userAttributes: this.attributes,
        });
      }
    }
  }
}
