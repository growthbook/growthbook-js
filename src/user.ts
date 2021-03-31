import { UserAttributes, Experiment, ExperimentResults } from './types';
import {
  checkRule,
  getWeightsFromOptions,
  chooseVariation,
  getQueryStringOverride,
  urlIsValid,
} from './util';
import GrowthBookClient from 'client';

export default class GrowthBookUser {
  private id: string;
  private anonId: string;
  private attributes: UserAttributes;
  client: GrowthBookClient;
  private experimentsTracked: Set<string>;
  private attributeMap: Map<string, string>;
  private assignedVariations: Map<
    string,
    {
      assigned: number;
      possible: any[];
    }
  > = new Map();
  private subscriptions: Set<() => void> = new Set();

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

  getAttributes(): UserAttributes {
    return this.attributes;
  }

  destroy() {
    // Remove all subscriptions
    this.subscriptions.clear();

    // Clean up maps
    this.assignedVariations.clear();
    this.attributeMap.clear();

    // Remove user from client
    const index = this.client.users.indexOf(this);
    if (index !== -1) {
      this.client.users.splice(index, 1);
    }
  }

  subscribe(cb: () => void) {
    this.subscriptions.add(cb);
    return () => {
      this.subscriptions.delete(cb);
    };
  }

  private alertSubscribers() {
    this.subscriptions.forEach(s => s());
  }

  private log(msg: string) {
    if (this.client.config.debug) {
      console.log(msg, {
        userId: this.id,
        anonId: this.anonId,
      });
    }
  }

  private isIncluded<T>(experiment: Experiment<T>): boolean {
    const isForced =
      'force' in experiment || this.client.forcedVariations.has(experiment.key);

    const numVariations = experiment.variations.length;
    if (numVariations < 2) {
      this.log(
        'variations must be at least 2, but only set to ' + numVariations
      );
      return false;
    }

    if (experiment.status === 'draft' && !isForced) {
      this.log('experiment in draft mode');
      return false;
    }

    if (experiment.status === 'stopped' && !isForced) {
      this.log('experiment is stopped');
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

  private getExperimentResults<T>(
    experiment?: Experiment<T>,
    variation: number = -1
  ): ExperimentResults {
    // Update the variation the user was assigned
    if (experiment && variation >= 0) {
      if (this.assignedVariations.get(experiment.key)?.assigned !== variation) {
        this.assignedVariations.set(experiment.key, {
          assigned: variation,
          possible: experiment.variations,
        });
        this.alertSubscribers();
      }
    }

    const index = variation >= 0 ? variation : 0;

    return {
      experiment,
      inExperiment: variation >= 0,
      index,
      value: experiment ? experiment.variations[index] : undefined,
    };
  }

  private runExperiment<T>(
    experiment: Experiment<T>,
    isOverride: boolean = false
  ): ExperimentResults<T> {
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

    // Forced via a client override
    if (this.client.forcedVariations.has(experiment.key)) {
      return this.getExperimentResults(
        experiment,
        this.client.forcedVariations.get(experiment.key)
      );
    }

    // Experiment variation is forced
    if (experiment.force !== undefined && experiment.force !== null) {
      this.log('variation forced to ' + experiment.force);
      return this.getExperimentResults(experiment, experiment.force);
    }

    if (this.client.config.qa) {
      this.log('client is in qa mode, assigning variation -1');
      return this.getExperimentResults(experiment);
    }

    const weights = getWeightsFromOptions(experiment);

    const userId = experiment?.anon ? this.anonId : this.id;

    // Hash unique id and experiment id to randomly choose a variation given weights
    const variation = chooseVariation(userId, experiment.key, weights);
    this.trackView(experiment, variation, userId, experiment.anon);

    this.log('user put in experiment, assigned variation ' + variation);

    return this.getExperimentResults(experiment, variation);
  }

  experiment<T>(experiment: Experiment<T>): ExperimentResults<T> {
    const override = this.client.overrides.get(experiment.key);
    if (override) {
      const exp = {
        ...experiment,
        ...override,
      };
      return this.runExperiment(exp, true);
    }

    return this.runExperiment(experiment);
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

  getAssignedVariations() {
    return new Map(this.assignedVariations);
  }
  getExperiments() {}

  private updateAttributeMap() {
    this.attributeMap.clear();
    this.flattenUserValues('', this.attributes).forEach(({ k, v }) => {
      this.attributeMap.set(k, v);
    });
  }

  private trackView<T>(
    experiment: Experiment<T>,
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
        this.client.config.onExperimentViewed({
          experiment,
          index: variation,
          value: experiment.variations[variation],
          [anon ? 'anonId' : 'userId']: userId,
          userAttributes: this.attributes,
        });
      }
    }
  }
}
