import { ConfigInterface } from './types';

const LOCALSTORAGE_ANONID_KEY = 'gbanonyid';

export const config: ConfigInterface = {
  attributes: {},
  enableQueryStringOverride: false,
  enabled: true,
  experiments: {},
  onExperimentViewed: undefined,
  userId: undefined,
  ga: undefined,
  segment: false,
};

const flattenUserValues = (prefix: string, val: any) => {
  if (val && typeof val === 'object') {
    let ret: { k: string; v: string }[] = [];
    Object.keys(val).forEach(key => {
      ret = ret.concat(
        flattenUserValues(prefix ? `${prefix}.${key}` : key, val[key])
      );
    });
    return ret;
  }
  return [{ k: prefix, v: '' + val }];
};

export const userMap: Map<string, string> = new Map();
const updateUserMap = () => {
  userMap.clear();
  flattenUserValues('', config.attributes).forEach(({ k, v }) => {
    userMap.set(k, v);
  });
};

const generateAnonymousId = () =>
  `${Date.now()}${Math.ceil(Math.random() * 1000000)}`;

export const configure = (c: Partial<ConfigInterface>) => {
  Object.assign(config, c);

  // Auto-generate
  if (!config.userId) {
    try {
      let anonId = window.localStorage.getItem(LOCALSTORAGE_ANONID_KEY);
      if (!anonId) {
        anonId = generateAnonymousId();
        window.localStorage.setItem(LOCALSTORAGE_ANONID_KEY, anonId);
      }
      config.userId = anonId;
    } catch (e) {
      // If there's a localStorage error, pick a random anonymous_id for this page view (better than nothing)
      config.userId = generateAnonymousId();
    }
  }

  if (c.attributes) {
    updateUserMap();
  }
};
