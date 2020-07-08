import { configure, config } from './config';
import { track } from './track';
import { experimentByUser, experimentByDevice } from './experiment';
import './browser';

export default {
  configure,
  getDefaultTrackingProps: () => {
    return {
      ...config.defaultTrackingProps,
    };
  },
  track,
  experimentByUser,
  experimentByDevice,
};
