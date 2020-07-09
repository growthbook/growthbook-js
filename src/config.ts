import { ConfigInterface } from './types';
import { processQueue } from './queue';

export const config: ConfigInterface = {
  trackingHost: null,
  userId: null,
  anonymousId: null,
  defaultTrackingProps: {},
  experimentConfig: {},
  trackOverride: null,
  experimentQueryStringOverride: false,
  enableExperiments: true,
};

const LOCALSTORAGE_ANONID_KEY = 'gbanonyid';

const generateAnonymousId = () =>
  `${Date.now()}${Math.ceil(Math.random() * 1000000)}`;

export const configure = (c: Partial<ConfigInterface>) => {
  const { defaultTrackingProps, experimentConfig, ...other } = c;

  // Do a deep merge of objects
  Object.assign(config.defaultTrackingProps, defaultTrackingProps || {});
  Object.assign(config.experimentConfig, experimentConfig || {});
  Object.assign(config, other);

  // Auto-generate
  if (!config.anonymousId) {
    try {
      let anonId = window.localStorage.getItem(LOCALSTORAGE_ANONID_KEY);
      if (!anonId) {
        anonId = generateAnonymousId();
        window.localStorage.setItem(LOCALSTORAGE_ANONID_KEY, anonId);
      }
      config.anonymousId = anonId;
    } catch (e) {
      // If there's a localStorage error, pick a random anonymous_id for this page view (better than nothing)
      config.anonymousId = generateAnonymousId();
    }
  }

  // Process any queued track events
  if (config.trackingHost || config.trackOverride) {
    processQueue();
  }
};

export const resetDefaultTrackingProps = () => {
  config.defaultTrackingProps = {};
};
export const resetExperimentConfig = () => {
  config.experimentConfig = {};
};
