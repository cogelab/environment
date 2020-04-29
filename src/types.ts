
export interface Meta {
  resolved: string;
  namespace: string;
  packagePath: string;
  templatePath: string;
}

export interface Metas {
  [ns: string]: Meta;
}
