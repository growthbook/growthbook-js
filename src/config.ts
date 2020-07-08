export interface EventProperties {
  [key: string]: any;
}

export interface ExperimentConfig {
  [key: string]: number;
}

export interface ConfigInterface {
  trackingHost: string | null;
  userId: string | null;
  anonymousId: string | null;
  defaultTrackingProps: EventProperties;
  experimentConfig: ExperimentConfig;
}

export const config: ConfigInterface = {
  trackingHost: null,
  userId: null,
  anonymousId: null,
  defaultTrackingProps: {},
  experimentConfig: {},
};

const LOCALSTORAGE_ANONID_KEY = 'gbanonyid';

export const configure = (c: Partial<ConfigInterface>) => {
  Object.assign(config, c);

  if (!config.anonymousId) {
    try {
      let anonId = window.localStorage.getItem(LOCALSTORAGE_ANONID_KEY);
      if (!anonId) {
        anonId = `${Date.now()}${Math.ceil(Math.random() * 1000000)}`;
        window.localStorage.setItem(LOCALSTORAGE_ANONID_KEY, anonId);
      }
      config.anonymousId = anonId;
    } catch (e) {
      // Not a critical error, ignore
    }
  }
};
