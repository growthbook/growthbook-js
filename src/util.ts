import GrowthBookClient from './client';
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

const isNum = /^[-]?[0-9]*(\.[0-9]*)?$/;
export function checkRule(
  actual: string,
  op: string,
  desired: string
): boolean {
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

export function chooseVariation(
  userId: string,
  testId: string,
  weights: number[] = [0.5, 0.5]
): number {
  // Hash the user id and testName to a number from 0 to 1;
  const n = (hashFnv32a(userId + testId) % 1000) / 1000;

  let cumulativeWeight = 0;
  for (let i = 0; i < weights.length; i++) {
    cumulativeWeight += weights[i];
    if (n < cumulativeWeight) {
      return i;
    }
  }

  return -1;
}

export function urlIsValid(
  urlRegex: string,
  client: GrowthBookClient
): boolean {
  const escaped = urlRegex.replace(/([^\\])\//g, '$1\\/');

  const url = client.config.url;
  if (!url) return false;

  const pathOnly = url.replace(/^https?:\/\//, '').replace(/^[^/]*\//, '/');

  try {
    const regex = new RegExp(escaped);
    if (regex.test(url)) return true;
    if (regex.test(pathOnly)) return true;
    return false;
  } catch (e) {
    return false;
  }
}

export function getQueryStringOverride(id: string, client: GrowthBookClient) {
  const url = client.config.url;

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

const appliedDomChanges = new Set();
export function clearAppliedDomChanges() {
  appliedDomChanges.clear();
}

function getEqualWeights(n: number): number[] {
  return new Array(n).fill(1 / n);
}

export function getWeightsFromOptions<T>(experiment: Experiment<T>) {
  // Full coverage by default
  let coverage =
    typeof experiment.coverage === 'undefined' ? 1 : experiment.coverage;
  if (coverage < 0 || coverage > 1) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Experiment.coverage must be between 0 and 1 inclusive');
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
