import { track } from './track';
import { config } from './config';

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

function chooseVariation(
  uid: string | null,
  testId: string,
  weights: number[] = [0.5, 0.5]
): number {
  if (!uid) {
    return -1;
  }

  // Hash the user id and testName to a number from 0 to 1;
  const n = (hashFnv32a(uid + testId) % 1000) / 1000;

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

const getPersistedVariations = (): { [key: string]: number } => {
  if (typeof window === 'undefined') return {};
  try {
    const mapping = window.localStorage.getItem('gb_test_mapping');
    if (!mapping) return {};
    const decoded = JSON.parse(mapping);
    return decoded || {};
  } catch (e) {
    // Ignore localstorage errors
    return {};
  }
};
const getPersistedVariation = (testId: string, uid: string) => {
  const mapping = getPersistedVariations();
  const k = testId + uid;
  if (k in mapping) return mapping[k];
  return null;
};
const setPersistedVariation = (
  testId: string,
  uid: string,
  variation: number
) => {
  try {
    window.localStorage.setItem(
      'gb_test_mapping',
      JSON.stringify({
        ...getPersistedVariations(),
        [testId + uid]: variation,
      })
    );
  } catch (e) {
    // Ignore localstorage errors
  }
};

export type ExperimentOptions = {
  coverage?: number;
  variations?: number;
  weights?: number[];
};

const getWeightsFromOptions = (options: ExperimentOptions) => {
  // 2-way test by default
  let variations = options.variations || 2;
  if (variations < 2 || variations > 20) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Experiment variations must be between 2 and 20');
    }
    variations = 2;
  }

  // Full coverage by default
  let coverage = options.coverage || 1;
  if (coverage <= 0 || coverage > 1) {
    if (process.env.NODE_ENV !== 'production') {
      console.error(
        'Experiment coverage must be greater than 0 and less than or equal to 1'
      );
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

const experimentsTracked = new Map();
const experiment = (
  id: string,
  uid: string | null,
  options: ExperimentOptions,
  persistLocalStorage: boolean
): number => {
  // If experiments are disabled globally
  if (!config.enableExperiments) {
    return -1;
  }

  // If querystring override is enabled
  if (config.experimentQueryStringOverride) {
    let override = getQueryStringOverride(id);
    if (override !== null) {
      return override;
    }
  }

  let optionsClone = { ...options };

  // If experiment settings are overridden in config
  if (id in config.experimentConfig) {
    // If experiment is stopped, return variation immediately
    if ('variation' in config.experimentConfig[id]) {
      return config.experimentConfig[id].variation || 0;
    }

    // Weights overridden
    if (config.experimentConfig[id].weights) {
      optionsClone.weights = config.experimentConfig[id].weights;
    }
    // Coverage overridden
    if (config.experimentConfig[id].coverage) {
      optionsClone.coverage = config.experimentConfig[id].coverage;
    }
  }

  if (!uid) {
    return -1;
  }

  if (persistLocalStorage) {
    const existingVariation = getPersistedVariation(id, uid);
    if (existingVariation !== null) {
      return existingVariation;
    }
  }

  const weights = getWeightsFromOptions(optionsClone);

  // Hash unique id and experiment id to randomly choose a variation given weights
  const variation = chooseVariation(uid, id, weights);

  if (persistLocalStorage) {
    setPersistedVariation(id, uid, variation);
  }

  // Only track an experiment once per user/test
  if (variation !== -1 && !experimentsTracked.has(uid + id)) {
    experimentsTracked.set(uid + id, variation);

    if (config.trackExperimentOverride) {
      config.trackExperimentOverride(id, variation);
    } else {
      track('viewed_experiment', {
        experiment: id,
        variation,
      });
    }
  }

  return variation;
};

export const experimentByUser = (id: string, options: ExperimentOptions = {}) =>
  experiment(id, config.userId, options, false);

export const experimentByDevice = (
  id: string,
  options: ExperimentOptions = {}
) => experiment(id, config.anonymousId, options, true);
