import {
  configure,
  resetDefaultTrackingProps,
  resetExperimentConfig,
} from './config';
import { track } from './track';
import { experimentByUser, experimentByDevice } from './experiment';
import './browser';

export default {
  configure,
  track,
  experimentByUser,
  experimentByDevice,
  resetDefaultTrackingProps,
  resetExperimentConfig,
};
