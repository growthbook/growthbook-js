import { Experiment } from 'types';

export function hashFnv32a(str: string): number {
  let hval = 0x811c9dc5;
  const l = str.length;

  for (let i = 0; i < l; i++) {
    hval ^= str.charCodeAt(i);
    hval +=
      (hval << 1) + (hval << 4) + (hval << 7) + (hval << 8) + (hval << 24);
  }
  return hval >>> 0;
}

export function chooseVariation(n: number, weights: number[]): number {
  let cumulativeWeight = 0;
  for (let i = 0; i < weights.length; i++) {
    cumulativeWeight += weights[i];
    if (n < cumulativeWeight) {
      return i;
    }
  }
  return -1;
}

export function getUrlRegExp(regexString: string): RegExp | null {
  try {
    const escaped = regexString.replace(/([^\\])\//g, '$1\\/');
    return new RegExp(escaped);
  } catch (e) {
    console.error(e);
    return null;
  }
}

export function getEqualWeights(n: number): number[] {
  return new Array(n).fill(1 / n);
}

export function getWeightsFromOptions<T>(experiment: Experiment<T>) {
  // Full coverage by default
  let coverage =
    typeof experiment.coverage === 'undefined' ? 1 : experiment.coverage;

  if (coverage < 0) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Experiment.coverage must be greater than or equal to 0');
    }
    coverage = 0;
  } else if (coverage > 1) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Experiment.coverage must be less than or equal to 1');
    }
    coverage = 1;
  }

  const equal = getEqualWeights(experiment.variations.length);

  let weights: number[] = experiment.weights || equal;

  if (weights.length !== experiment.variations.length) {
    if (process.env.NODE_ENV !== 'production') {
      console.error(
        'Experiment.weights array must be the same length as Experiment.variations'
      );
    }
    weights = equal;
  }

  // If weights don't add up to 1 (or close to it), default to equal weights
  const totalWeight = weights.reduce((w, sum) => sum + w, 0);
  if (totalWeight < 0.99 || totalWeight > 1.01) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Experiment.weights must add up to 1');
    }
    weights = equal;
  }

  // Scale weights by traffic coverage
  return weights.map(n => n * coverage);
}

export function getQueryStringOverride(id: string, url: string) {
  if (!url) {
    return null;
  }

  const search = url.split('?')[1];
  if (!search) {
    return null;
  }

  const match = search
    .replace(/#.*/, '') // Get rid of anchor
    .split('&') // Split into key/value pairs
    .map(kv => kv.split('=', 2))
    .filter(([k]) => k === id) // Look for key that matches the experiment id
    .map(([, v]) => parseInt(v)); // Parse the value into an integer

  if (match.length > 0 && match[0] >= -1 && match[0] < 10) return match[0];

  return null;
}

export function isIncluded(include: () => boolean) {
  try {
    return include();
  } catch (e) {
    console.error(e);
    return false;
  }
}
