interface EventProperties {
  [key: string]: any;
}

interface ConfigInterface {
  public_key: string;
  user_id: string | null;
  anonymous_id: string | null;
  defaultTrackingProps: EventProperties;
}

const settings: ConfigInterface = {
  public_key: '',
  user_id: null,
  anonymous_id: null,
  defaultTrackingProps: {},
};

const LOCALSTORAGE_ANONID_KEY = 'gbanonyid';

export const init = (public_key: string): void => {
  settings.public_key = public_key;

  try {
    let anonId = window.localStorage.getItem(LOCALSTORAGE_ANONID_KEY);
    if (!anonId) {
      anonId = `${Date.now()}${Math.ceil(Math.random() * 1000000)}`;
      window.localStorage.setItem(LOCALSTORAGE_ANONID_KEY, anonId);
    }
    settings.anonymous_id = anonId;
  } catch (e) {
    // Not a critical error, ignore
  }
};
export const setUserId = (user_id: string | null): void => {
  settings.user_id = user_id;
};
export const setDefaultTrackingProps = (
  defaultTrackingProps: EventProperties
): void => {
  settings.defaultTrackingProps = defaultTrackingProps;
};

export const track = (
  event: string,
  properties: EventProperties
) => {
  if (!settings.public_key.length) {
    if(process.env.NODE_ENV !== "production") {
      throw Error('Must call growthbook.init before tracking events');
    }
    return;
  }

  // TODO: make isomorphic
  if(typeof navigator !== 'undefined' && navigator.sendBeacon) {
    navigator.sendBeacon(
      `https://api.growthbook.io/track/${settings.public_key}`, 
      new Blob([JSON.stringify({
        event,
        properties: {
          ...settings.defaultTrackingProps,
          ...properties,
          anonymous_id: settings.anonymous_id,
          user_id: settings.user_id,
        },
      })], {type: 'application/json'})
    );
  }
};

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
  const variation = chooseVariation(uid, id, weights);

  // Only track an experiment once per user/test
  if (!experimentsTracked.has(uid + id)) {
    experimentsTracked.set(uid + id, variation);
    track('viewed_experiment', {
      experiment: id,
      variation,
    });
  }

  return variation;
};

export const userExperiment = (id: string, weights: number[] = [0.5, 0.5]) =>
  experiment(id, settings.user_id, weights);
export const anonExperiment = (id: string, weights: number[] = [0.5, 0.5]) =>
  experiment(id, settings.anonymous_id, weights);

export default {
  init,
  setUserId,
  setDefaultTrackingProps,
  track,
  userExperiment,
  anonExperiment,
};
