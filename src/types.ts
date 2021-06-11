export interface Experiment<T> {
  key: string;
  variations: [T, T, ...T[]];
  weights?: number[];
  status?: 'draft' | 'running' | 'stopped';
  coverage?: number;
  url?: RegExp;
  include?: () => boolean;
  groups?: string[];
  force?: number;
  hashAttribute?: string;
}

export type ExperimentOverride = Pick<
  Experiment<any>,
  'weights' | 'status' | 'force' | 'coverage' | 'groups'
> & {
  url?: RegExp | string;
};

export interface Result<T> {
  value: T;
  variationId: number;
  inExperiment: boolean;
  hashAttribute: string;
  hashValue: string;
}

export interface Context {
  enabled?: boolean;
  user?: {
    id?: string;
    anonId?: string;
    [key: string]: string | undefined;
  };
  groups?: Record<string, boolean>;
  url?: string;
  overrides?: Record<string, ExperimentOverride>;
  forcedVariations?: Record<string, number>;
  qaMode?: boolean;
  trackingCallback?: (experiment: Experiment<any>, result: Result<any>) => void;
}

export type SubscriptionFunction = (
  experiment: Experiment<any>,
  result: Result<any>
) => void;
