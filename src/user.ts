import { Experiment, ExperimentResults } from './types';
import {
  getWeightsFromOptions,
  chooseVariation,
  getQueryStringOverride,
  urlIsValid,
} from './util';
import GrowthBookClient from 'client';

export default class GrowthBookUser<U extends Record<string, string>> {
  private ids: U;
  private groups: Record<string, boolean>;
  client: GrowthBookClient;
  private experimentsTracked: Set<string>;
  private assignedVariations: Map<
    string,
    {
      assigned: number;
      possible: any[];
    }
  > = new Map();
  private subscriptions: Set<() => void> = new Set();

  constructor(
    ids: U,
    groups: Record<string, boolean>,
    client: GrowthBookClient
  ) {
    this.ids = { ...ids };
    this.groups = { ...groups };
    this.client = client;

    this.experimentsTracked = new Set();
  }

  destroy() {
    // Remove all subscriptions
    this.subscriptions.clear();

    // Clean up maps
    this.assignedVariations.clear();

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
      console.log(msg, this.ids);
    }
  }

  private isValidExperiment<T>(experiment: Experiment<T, U>): boolean {
    const numVariations = experiment.variations.length;
    if (numVariations < 2) {
      this.log(
        'variations must be at least 2, but only set to ' + numVariations
      );
      return false;
    }

    const isForced =
      'force' in experiment || this.client.forcedVariations.has(experiment.key);

    if (!isForced) {
      if (experiment.status === 'draft') {
        this.log('experiment in draft mode');
        return false;
      }

      if (experiment.status === 'stopped') {
        this.log('experiment is stopped');
        return false;
      }
    }

    return true;
  }

  private userInGroup(group: string): boolean {
    return group in this.groups && this.groups[group];
  }

  private isIncluded<T>(experiment: Experiment<T, U>): boolean {
    // Missing userHashKey
    const userHashKey = this.getUserHashKey(experiment);
    if (!(this.ids as any)[userHashKey || 'id']) {
      this.log('user missing required id: ' + userHashKey);
      return false;
    }

    // Custom include callback
    if (experiment.include && !experiment.include()) {
      this.log('the `include` callback returned false');
      return false;
    }

    // Only specific user groups allowed
    if (
      experiment.groups &&
      !experiment.groups.filter(g => this.userInGroup(g)).length
    ) {
      this.log(
        'experiment limited to groups ' +
          JSON.stringify(experiment.groups) +
          ', user in groups ' +
          JSON.stringify(this.groups)
      );
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
    experiment: Experiment<T, U>,
    variation: number = -1
  ): ExperimentResults<T, U> {
    // Update the variation the user was assigned
    if (experiment) {
      if (this.assignedVariations.get(experiment.key)?.assigned !== variation) {
        this.assignedVariations.set(experiment.key, {
          assigned: variation,
          possible: experiment.variations,
        });
        this.alertSubscribers();
      }
    }

    const variationId = variation >= 0 ? variation : 0;

    return {
      experiment,
      inExperiment: variation >= 0,
      variationId,
      index: variationId,
      value: experiment.variations[variationId],
    };
  }

  private runExperiment<T>(
    experiment: Experiment<T, U>,
    isOverride: boolean = false
  ): ExperimentResults<T, U> {
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

    if (!this.isValidExperiment(experiment)) {
      this.log('not a valid experiment, assigning variation -1');
      return this.getExperimentResults(experiment);
    }

    // Forced via the client (only used during development)
    if (this.client.forcedVariations.has(experiment.key)) {
      return this.getExperimentResults(
        experiment,
        this.client.forcedVariations.get(experiment.key)
      );
    }

    // If it fails targeting rules
    if (!this.isIncluded(experiment)) {
      this.log('not included in experiment, assigning variation -1');
      return this.getExperimentResults(experiment);
    }

    // Forced in the experiment definition itself
    if (experiment.force !== undefined && experiment.force !== null) {
      this.log('variation forced to ' + experiment.force);
      return this.getExperimentResults(experiment, experiment.force);
    }

    if (this.client.config.qa) {
      this.log('client is in qa mode, assigning variation -1');
      return this.getExperimentResults(experiment);
    }

    const weights = getWeightsFromOptions(experiment);

    const userHashKey = this.getUserHashKey(experiment);
    const userHashValue = this.ids[userHashKey];

    // Hash unique id and experiment id to randomly choose a variation given weights
    const variation = chooseVariation(userHashValue, experiment.key, weights);
    this.trackView(experiment, variation);

    this.log(
      'user put in experiment using hash key `' +
        userHashKey +
        '`, assigned variation ' +
        variation
    );

    return this.getExperimentResults(experiment, variation);
  }

  experiment<T>(experiment: Experiment<T, U>): ExperimentResults<T, U> {
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

  private getUserHashKey<T>(exp: Experiment<T, U>): keyof U {
    if (exp.userHashKey) return exp.userHashKey;
    return exp.anon ? 'anonId' : 'id';
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

  private trackView<T>(experiment: Experiment<T, U>, variation: number) {
    const userHashKey = this.getUserHashKey(experiment);
    const userHashValue = this.ids[userHashKey];

    // Only track an experiment once per user/test
    if (
      variation !== -1 &&
      !this.experimentsTracked.has(userHashKey + userHashValue + experiment.key)
    ) {
      this.experimentsTracked.add(userHashKey + userHashValue + experiment.key);

      if (this.client.config.onExperimentViewed) {
        this.client.config.onExperimentViewed({
          experiment: experiment as Experiment<any, any>,
          experimentId: experiment.key,
          index: variation,
          user: this,
          userHashKey: userHashKey as string,
          variationId: variation,
          value: experiment.variations[variation],
        });
      }
    }
  }
}
