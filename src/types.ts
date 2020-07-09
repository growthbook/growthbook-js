export interface EventProperties {
  [key: string]: any;
}

export interface ExperimentConfig {
  [key: string]: {
    variation?: number;
    weights?: number[];
    coverage?: number;
  };
}

export type TrackFunction = (
  event: string,
  properties: EventProperties
) => void;

export type TrackExperimentFunction = (
  experiment: string,
  variation: number
) => void;

export interface ConfigInterface {
  trackingHost: string | null;
  userId: string | null;
  anonymousId: string | null;
  defaultTrackingProps: EventProperties;
  experimentConfig: ExperimentConfig;
  trackExperimentOverride: TrackExperimentFunction | null;
  experimentQueryStringOverride: boolean;
  enableExperiments: boolean;
}
