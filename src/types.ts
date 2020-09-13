export interface UserAttributes {
  [key: string]: any;
}

export interface ConfigData {
  [key: string]: string[];
}

export interface ExperimentReturnData {
  experiment: string;
  variation: number;
  data: {
    [key: string]: string;
  };
}

export interface ConfigReturnData {
  experiment?: string;
  variation?: number;
  value?: string;
}

export interface ExperimentParams {
  variations?: number;
  weights?: number[];
  coverage?: number;
  targeting?: string[];
  configData?: ConfigData;
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
