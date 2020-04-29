
export interface Meta {
  resolved: string;
  namespace: string;
  packagePath: string;
}

export interface Metas {
  [ns: string]: Meta;
}
