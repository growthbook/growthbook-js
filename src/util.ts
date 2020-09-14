import { ExperimentParams } from 'types';

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

export function getQueryStringOverride(id: string) {
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
}

export function getWeightsFromOptions(options: ExperimentParams) {
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
}
