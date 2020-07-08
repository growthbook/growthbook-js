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

const experimentsTracked = new Map();
const experiment = (
  id: string,
  uid: string | null,
  weights: number[]
): number => {
  // If experiment is stopped, immediately return the selected variation
  if (id in config.experimentConfig) {
    return config.experimentConfig[id];
  }

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
