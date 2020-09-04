export interface UserAttributes {
  [key: string]: any;
}

export interface ExperimentParams {
  variations?: number;
  weights?: number[];
  coverage?: number;
  targeting?: string[];
  force?: number;
}

export interface ExperimentsConfig {
  [key: string]: ExperimentParams;
}

export type TrackExperimentFunction = (
  experiment: string,
  variation: number
) => void;

export interface ConfigInterface {
  enabled?: boolean;
  onAssignment?: TrackExperimentFunction;
  enableQueryStringOverride?: boolean;
  uuid?: string;
  attributes?: UserAttributes;
  experiments?: ExperimentsConfig;
}
