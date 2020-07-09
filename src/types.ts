export interface EventProperties {
  [key: string]: any;
}

export interface ExperimentConfig {
  [key: string]: number;
}

export type TrackFunction = (
  event: string,
  properties: EventProperties
) => void;

export interface ConfigInterface {
  trackingHost: string | null;
  userId: string | null;
  anonymousId: string | null;
  defaultTrackingProps: EventProperties;
  experimentConfig: ExperimentConfig;
  trackOverride: TrackFunction | null;
  experimentQueryStringOverride: boolean;
  enableExperiments: boolean;
}
