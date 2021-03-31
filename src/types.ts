export interface UserAttributes {
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

export interface ExperimentResults<T = any> {
  value: T;
  index: number;
  inExperiment: boolean;
  experiment?: Experiment<T>;
}

export interface DataLookupResults<T = any> {
  experiment?: Experiment<T>;
  index?: number;
  value: T | undefined;
}

export interface Experiment<T> {
  key: string;
  variations: T[];
  weights?: number[];
  anon?: boolean;
  status?: 'draft' | 'running' | 'stopped';
  force?: number;
  coverage?: number;
  targeting?: string[];
  url?: string;
}

export interface ExperimentOverride {
  weights?: number[];
  status?: 'draft' | 'running' | 'stopped';
  force?: number;
  coverage?: number;
  targeting?: string[];
  url?: string;
}

export type TrackExperimentFunctionProps<T = any> = {
  experiment: Experiment<T>;
  value: T;
  index: number;
  userId?: string;
  anonId?: string;
  userAttributes?: UserAttributes;
};

export type TrackExperimentFunction = (
  info: TrackExperimentFunctionProps
) => void;

export interface ClientConfigInterface {
  url?: string;
  debug?: boolean;
  qa?: boolean;
  onExperimentViewed?: TrackExperimentFunction;
  enableQueryStringOverride?: boolean;
}
