export interface UserAttributes {
  [key: string]: unknown;
}
export interface ExperimentData {
  [key: string]: unknown[];
}
export interface VariationData {
  [key: string]: unknown;
}

export type UserArg =
  | {
      anonId: string;
      id?: string;
      attributes?: UserAttributes;
    }
  | {
      anonId?: string;
      id: string;
      attributes?: UserAttributes;
    };

export interface ExperimentResults {
  experiment: string;
  variation: number;
  data: VariationData;
}

export interface DataLookupResults {
  experiment?: string;
  variation?: number;
  value?: unknown;
  data?: VariationData;
}

export interface ExperimentParams {
  variations?: number;
  weights?: number[];
  coverage?: number;
  targeting?: string[];
  anon?: boolean;
  data?: ExperimentData;
  force?: number;
}

export interface ExperimentsConfig {
  [key: string]: ExperimentParams;
}

export type TrackExperimentFunctionProps = {
  experiment: string;
  variation: number;
  userId?: string;
  anonId?: string;
  data?: VariationData;
  userAttributes?: UserAttributes;
};

export type TrackExperimentFunction = (
  info: TrackExperimentFunctionProps
) => void;

export interface ClientConfigInterface {
  enabled?: boolean;
  onExperimentViewed?: TrackExperimentFunction;
  enableQueryStringOverride?: boolean;
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
