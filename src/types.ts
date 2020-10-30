export interface Meta {
  resolved: string;
  namespace: string;
  packagePath?: string;
  templateDir: string;
}

export interface Metas {
  [ns: string]: Meta;
}
