import GrowthBookClient from './client';
import { Experiment, DomChange } from 'types';

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

export function applyDomMods({
  dom,
  css,
}: {
  dom?: DomChange[];
  css?: string;
}): () => void {
  const noop = () => {
    // Do nothing
  };

  // Only works on a browser environment
  if (typeof window === 'undefined') {
    return noop;
  }

  function runMods(): () => void {
    let revert: (() => void)[] = [];

    if (dom) {
      dom.forEach(({ selector, mutation, value }) => {
        // Make sure we're only applying DOM changes once
        const key = selector + '__' + mutation + '__' + value;
        if (appliedDomChanges.has(key)) {
          return;
        }
        appliedDomChanges.add(key);

        const nodes = document.querySelectorAll(selector);
        nodes.forEach(el => {
          const cl = el.classList;
          if (mutation === 'addClass') {
            const classes = value.split(/[\s.]+/).filter(Boolean);

            classes.forEach(c => cl.add(c));
            revert.push(() => {
              classes.forEach(c => cl.remove(c));
            });
          } else if (mutation === 'removeClass') {
            const classes = value.split(/[\s.]+/).filter(Boolean);

            classes.forEach(c => cl.remove(c));
            revert.push(() => {
              classes.forEach(c => cl.add(c));
            });
          } else if (mutation === 'appendHTML') {
            const current = el.innerHTML;
            el.innerHTML += value;
            revert.push(() => (el.innerHTML = current));
          } else if (mutation === 'setHTML') {
            const current = el.innerHTML;
            el.innerHTML = value;
            revert.push(() => (el.innerHTML = current));
          } else if (mutation === 'setAttribute') {
            let [attr, val] = value.split('=');
            attr = attr.trim();
            val = val.trim().replace(/(^"|"$)/g, '');

            if (attr && val) {
              const current = el.getAttribute(attr);
              el.setAttribute(attr, val);
              revert.push(() =>
                current === null
                  ? el.removeAttribute(attr)
                  : el.setAttribute(attr, current)
              );
            }
          }
        });
      });
    }
    if (css) {
      // Make sure we're only applying CSS changes once
      if (!appliedDomChanges.has(css)) {
        appliedDomChanges.add(css);

        const style = document.createElement('style');
        document.head.appendChild(style);
        style.innerHTML = css;

        revert.push(() => {
          style.remove();
          appliedDomChanges.delete(css);
        });
      }
    }

    revert.reverse();
    return () => {
      revert.forEach(f => f());
    };
  }

  if (
    document.readyState === 'interactive' ||
    document.readyState === 'complete'
  ) {
    return runMods();
  } else {
    let revert: () => void;
    const listener = () => {
      if (
        document.readyState === 'interactive' ||
        document.readyState === 'complete'
      ) {
        document.removeEventListener('readystatechange', listener);
        revert = runMods();
      }
    };
    document.addEventListener('readystatechange', listener);

    return () => {
      if (revert) {
        revert();
      } else {
        document.removeEventListener('readystatechange', listener);
      }
    };
  }
}

export function getWeightsFromOptions(experiment: Experiment) {
  // 2-way test by default
  let variations = experiment.variations || 2;
  if (variations < 2 || variations > 20) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Experiment variations must be between 2 and 20');
    }
    variations = 2;
  }

  // Full coverage by default
  let coverage =
    typeof experiment.coverage === 'undefined' ? 1 : experiment.coverage;
  if (coverage < 0 || coverage > 1) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Experiment coverage must be between 0 and 1 inclusive');
    }
    coverage = 1;
  }

  let weights = experiment.variationInfo?.map(v => v.weight || 0) || [];

  // If wrong number of weights, or weights don't add up to 1 (or close to it), default to equal weights
  const totalWeight = weights.reduce((w, sum) => sum + w, 0);
  if (
    weights.length !== variations ||
    totalWeight < 0.99 ||
    totalWeight > 1.01
  ) {
    weights = new Array(variations).fill(1 / variations);
  }

  // Scale weights by traffic coverage
  return weights.map(n => n * coverage);
}
