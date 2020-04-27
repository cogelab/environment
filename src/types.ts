
export interface Generator {
  resolved: string;
  namespace: string;
  packagePath: string;
}

export interface Generators {
  [ns: string]: Generator;
}
