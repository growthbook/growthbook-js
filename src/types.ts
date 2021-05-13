export interface ExperimentResults<
  T = any,
  U extends Record<string, any> = {}
> {
  value: T;
  variationId: number;
  inExperiment: boolean;
  /** @deprecated */
  index: number;
  /** @deprecated */
  experiment?: Experiment<T, U>;
}

export interface Experiment<T, U extends Record<string, any> = {}> {
  key: string;
  variations: T[];
  weights?: number[];
  randomizationUnit?: keyof U;
  include?: () => boolean;
  groups?: string[];
  status?: 'draft' | 'running' | 'stopped';
  force?: number;
  coverage?: number;
  url?: string;
  /** @deprecated */
  targeting?: string[];
  /** @deprecated */
  anon?: boolean;
}

export interface ExperimentOverride {
  weights?: number[];
  status?: 'draft' | 'running' | 'stopped';
  force?: number;
  coverage?: number;
  groups?: string[];
  url?: string;
  /** @deprecated */
  targeting?: string[];
}

export type TrackExperimentFunctionProps<
  T = any,
  U extends Record<string, any> = {}
> = {
  experimentId: string;
  variationId: number;
  experiment: Experiment<T, U>;
  value: T;
  randomizationUnit: string;
  user: U;
  /** @deprecated */
  index: number;
  /** @deprecated */
  userId?: string;
  /** @deprecated */
  anonId?: string;
  /** @deprecated */
  userAttributes?: any;
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
