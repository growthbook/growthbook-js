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
  onExperimentViewed?: TrackExperimentFunction;
  enableQueryStringOverride?: boolean;
  userId?: string;
  attributes?: UserAttributes;
  experiments?: ExperimentsConfig;
  segment?: boolean;
  ga?: number;
}

export type AnalyticsWindow = typeof window & {
  analytics?: {
    track?: (event: string, props: any) => void;
  };
  ga?: (
    func: string,
    event: string,
    category: string,
    action?: string,
    label?: string,
    value?: number
  ) => void;
};
