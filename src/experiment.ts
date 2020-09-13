import { config, userMap } from './config';
import {
  ExperimentParams,
  AnalyticsWindow,
  ConfigData,
  ExperimentReturnData,
  ConfigReturnData,
} from 'types';

const isNum = /^[-]?[0-9]*(\.[0-9]*)?$/;

function hashFnv32a(str: string): number {
  let hval = 0x811c9dc5;
  const l = str.length;

  for (let i = 0; i < l; i++) {
    hval ^= str.charCodeAt(i);
    hval +=
      (hval << 1) + (hval << 4) + (hval << 7) + (hval << 8) + (hval << 24);
  }
  return hval >>> 0;
}

function checkRule(actual: string, op: string, desired: string): boolean {
  // Numeric data
  let actualNumeric, desiredNumeric;
  if (actual.match(isNum) && desired.match(isNum)) {
    actualNumeric = parseFloat(actual);
    desiredNumeric = parseFloat(desired);
  }

  switch (op) {
    case '=':
      return actual === desired;
    case '!=':
      return actual !== desired;
    case '>':
      return actualNumeric !== undefined && desiredNumeric !== undefined
        ? actualNumeric > desiredNumeric
        : actual > desired;
    case '<':
      return actualNumeric !== undefined && desiredNumeric !== undefined
        ? actualNumeric < desiredNumeric
        : actual < desired;
    case '~':
      return !!actual.match(new RegExp(desired));
    case '!~':
      return !actual.match(new RegExp(desired));
  }
  if (process.env.NODE_ENV !== 'production') {
    console.error('Unknown targeting rule operator: ', op);
  }
  return true;
}

function isTargeted(rules: string[]): boolean {
  for (let i = 0; i < rules.length; i++) {
    const parts = rules[i].split(' ', 3);
    if (
      !checkRule(
        userMap.get(parts[0].trim()) || '',
        parts[1].trim() || '',
        parts[2].trim() || ''
      )
    ) {
      return false;
    }
  }

  return true;
}

function chooseVariation(
  testId: string,
  weights: number[] = [0.5, 0.5]
): number {
  if (!config.userId) {
    return -1;
  }

  // Hash the user id and testName to a number from 0 to 1;
  const n = (hashFnv32a(config.userId + testId) % 1000) / 1000;

  let cumulativeWeight = 0;
  for (let i = 0; i < weights.length; i++) {
    cumulativeWeight += weights[i];
    if (n < cumulativeWeight) {
      return i;
    }
  }

  return -1;
}

const getQueryStringOverride = (id: string) => {
  if (typeof window === 'undefined') {
    return null;
  }

  const match = window.location.search
    .substring(1)
    .split('&')
    .map(kv => kv.split('=', 2))
    .filter(([k]) => k === id)
    .map(([, v]) => parseInt(v));

  if (match.length > 0 && match[0] >= -1 && match[0] < 10) return match[0];

  return null;
};

const getWeightsFromOptions = (options: ExperimentParams) => {
  // 2-way test by default
  let variations = options.variations || 2;
  if (variations < 2 || variations > 20) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Experiment variations must be between 2 and 20');
    }
    variations = 2;
  }

  // Full coverage by default
  let coverage = typeof options.coverage === 'undefined' ? 1 : options.coverage;
  if (coverage < 0 || coverage > 1) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Experiment coverage must be between 0 and 1 inclusive');
    }
    coverage = 1;
  }

  // Equal weights by default
  let weights = options.weights || new Array(variations).fill(1 / variations);
  if (weights.length !== variations) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Experiment weights for every variation must be specified');
    }
    weights = new Array(variations).fill(1 / variations);
  }

  // Scale weights by traffic coverage
  return weights.map(n => n * coverage);
};

const experimentsTracked = new Set();
const trackView = (experiment: string, variation: number) => {
  // Only track an experiment once per user/test
  if (variation !== -1 && !experimentsTracked.has(config.userId + experiment)) {
    experimentsTracked.add(config.userId + experiment);

    if (typeof window !== 'undefined') {
      const w = window as AnalyticsWindow;
      if (config.segment) {
        const t = w?.analytics?.track;
        if (t) {
          t('Experiment Viewed', {
            experiment_id: experiment,
            variation_id: variation,
          });
        }
      }
      if (config.ga) {
        const g = w?.ga;
        if (g && typeof g === 'function') {
          g('set', `dimension${config.ga}`, experiment + ':' + variation);
          g('send', 'event', 'experiment', experiment, variation + '');
        }
      }
    }
    if (config.onExperimentViewed) {
      config.onExperimentViewed(experiment, variation);
    }
  }
};

const getConfigData = (
  id: string,
  inlineOptions?: ExperimentParams
): ConfigData => {
  if (config.experiments && id in config.experiments) {
    const override = config.experiments[id].configData;
    if (override) {
      return override;
    }
  }

  if (inlineOptions && inlineOptions.configData) {
    return inlineOptions.configData;
  }

  return {};
};

const getReturnData = (
  id: string,
  variation: number,
  inlineOptions?: ExperimentParams
): ExperimentReturnData => {
  const configData = getConfigData(id, inlineOptions);

  const data: { [key: string]: string } = {};
  Object.keys(configData).forEach(k => {
    data[k] = configData[k][variation] || configData[k][0];
  });

  return {
    experiment: id,
    variation,
    data,
  };
};

export const experiment = (
  id: string,
  options?: ExperimentParams
): ExperimentReturnData => {
  // If experiments are disabled globally
  if (!config.enabled) {
    return getReturnData(id, -1, options);
  }

  // If querystring override is enabled
  if (config.enableQueryStringOverride) {
    let override = getQueryStringOverride(id);
    if (override !== null) {
      return getReturnData(id, override, options);
    }
  }

  if (!config.userId) {
    return getReturnData(id, -1, options);
  }

  // If experiment settings are overridden in config
  if (!options) options = {};
  let optionsClone = { ...options };
  if (config.experiments && id in config.experiments) {
    // Value is forced, return immediately
    const { force, ...overrides } = config.experiments[id];
    if (force !== undefined) {
      return getReturnData(id, force, options);
    }
    Object.assign(optionsClone, overrides);
  }

  // Experiment has targeting rules, check if user matches
  if (optionsClone.targeting && !isTargeted(optionsClone.targeting)) {
    return getReturnData(id, -1, options);
  }

  const weights = getWeightsFromOptions(optionsClone);

  // Hash unique id and experiment id to randomly choose a variation given weights
  const variation = chooseVariation(id, weights);
  trackView(id, variation);

  return getReturnData(id, variation, options);
};

export function clearExperimentsTracked() {
  experimentsTracked.clear();
}

export function getConfigFromExperiments(key: string): ConfigReturnData {
  if (config.experiments) {
    const ids = Object.keys(config.experiments);
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const exp = config.experiments[id];

      if (exp.configData && exp.configData[key]) {
        const ret = experiment(id);
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
