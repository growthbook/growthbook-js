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
  variation: number;
  experiment?: Experiment;
  data?: VariationData;
  apply: () => void;
}

export interface DataLookupResults {
  experiment?: Experiment;
  variation?: number;
  value?: unknown;
}

export type DomChangeMethod =
  | "addClass"
  | "removeClass"
  | "appendHTML"
  | "setHTML"
  | "setAttribute";

export interface DomChange {
  selector: string;
  mutation: DomChangeMethod;
  value: string;
};

export interface VariationInfo {
  key?: string;
  weight?: number;
  data?: {
    [key: string]: unknown;
  };
  dom?: DomChange[];
  css?: string;
}

export interface Experiment {
  key: string;
  variations: number;
  variationInfo?: VariationInfo[];
  auto?: boolean;
  anon?: boolean;
  status?: "draft" | "running" | "stopped";
  force?: number;
  coverage?: number;
  targeting?: string[];
  url?: string;
  // @deprecated
  //weights?: number[];
  // @deprecated
  //data?: { [key: string]: unknown[] };
};

export type TrackExperimentFunctionProps = {
  experiment: Experiment;
  variation: number;
  variationKey: string;
  userId?: string;
  anonId?: string;
  data?: VariationData;
  userAttributes?: UserAttributes;
  dom?: DomChange[];
  css?: string;
};

export type TrackExperimentFunction = (
  info: TrackExperimentFunctionProps
) => void;

export interface ClientConfigInterface {
  enabled?: boolean;
  url?: string;
  onExperimentViewed?: TrackExperimentFunction;
  enableQueryStringOverride?: boolean;
}