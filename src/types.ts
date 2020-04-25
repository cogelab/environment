
export interface Template {
  resolved: string;
  namespace: string;
  packagePath: string;
}

export interface Templates {
  [ns: string]: Template;
}
