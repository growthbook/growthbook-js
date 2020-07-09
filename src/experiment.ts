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

const experimentsTracked = new Map();
const experiment = (
  id: string,
  uid: string | null,
  weights: number[]
): number => {
  // If experiments are disabled globally
  if (!config.enableExperiments) {
    return -1;
  }

  // If querystring override is enabled
  if (config.experimentQueryStringOverride) {
    let override = getQueryStringOverride(id);
    if (override !== null) {
      if (override >= weights.length) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(
            `Experiment querystring override for ${id} set to ${override}, but the max is ${weights.length -
              1}. Using ${weights.length - 1} instead.`
          );
        }
        override = weights.length - 1;
      }
      return override;
    }
  }

  // If experiment is stopped, immediately return the selected variation
  if (id in config.experimentConfig) {
    return config.experimentConfig[id];
  }

  // Hash unique id and experiment id to randomly choose a variation given weights
  const variation = chooseVariation(uid, id, weights);

  // Only track an experiment once per user/test
  if (variation !== -1 && !experimentsTracked.has(uid + id)) {
    experimentsTracked.set(uid + id, variation);
    track('viewed_experiment', {
      experiment: id,
      variation,
    });
  }

  return variation;
};

export const experimentByUser = (id: string, weights: number[] = [0.5, 0.5]) =>
  experiment(id, config.userId, weights);

export const experimentByDevice = (
  id: string,
  weights: number[] = [0.5, 0.5]
) => experiment(id, config.anonymousId, weights);
