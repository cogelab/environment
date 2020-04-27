import {Generators} from "./types";

const debug = require('debug')('coge:environment:store');

/**
 * The Generator store
 * This is used to store generator (npm packages) reference and instantiate them when
 * requested.
 * @constructor
 * @private
 */
export class Store {
  _generators: Generators;
  _packagesPaths: { [name: string]: string[] };
  _packagesNS: string[];

  constructor() {
    this._generators = {};
    // Store packages paths by ns
    this._packagesPaths = {};
    // Store packages ns
    this._packagesNS = [];
  }

  /**
   * Store a module under the namespace key
   * @param {String} namespace  - The key under which the generator can be retrieved
   * @param {String} generator  - A generator module or a module path
   * @param {String} packagePath - PackagePath to the generator npm package (optional)
   */
  add(namespace: string, generator: string, packagePath?: string) {
    this._storeAsPath(namespace, generator, packagePath);
  }

  _storeAsPath(namespace, path, packagePath) {
    this._generators[namespace] = {
      resolved: path,
      namespace,
      packagePath
    };
  }

  /**
   * Get the module registered under the given namespace
   * @param  {String} namespace
   * @return {Module}
   */
  get(namespace) {
    return this._generators[namespace];
  }

  /**
   * Returns the list of registered namespace.
   * @return {Array} Namespaces array
   */
  namespaces() {
    return Object.keys(this._generators);
  }

  /**
   * Get the stored generators meta data
   * @return {Object} Generators metadata
   */
  getGenerators() {
    return this._generators;
  }

  /**
   * Store a package under the namespace key
   * @param {String}     packageNS - The key under which the generator can be retrieved
   * @param {String}   packagePath - The package path
   */
  addPackage(packageNS, packagePath) {
    if (this._packagesPaths[packageNS]) {
      // Yo environment allows overriding, so the last added has preference.
      if (this._packagesPaths[packageNS][0] !== packagePath) {
        const packagePaths = this._packagesPaths[packageNS];
        debug('Overriding a package with namespace %s and path %s, with path %s',
          packageNS, this._packagesPaths[packageNS][0], packagePath);
        // Remove old packagePath
        const index = packagePaths.indexOf(packagePath);
        if (index > -1) {
          packagePaths.splice(index, 1);
        }
        packagePaths.splice(0, 0, packagePath);
      }
    } else {
      this._packagesPaths[packageNS] = [packagePath];
    }
  }

  /**
   * Get the stored packages namespaces with paths.
   * @return {Object} Stored packages namespaces with paths.
   */
  getPackagesPaths() {
    return this._packagesPaths;
  }

  /**
   * Store a package ns
   * @param {String} packageNS - The key under which the generator can be retrieved
   */
  addPackageNS(packageNS) {
    if (!this._packagesNS.includes(packageNS)) {
      this._packagesNS.push(packageNS);
    }
  }

  /**
   * Get the stored packages namespaces.
   * @return {Array} Stored packages namespaces.
   */
  getPackagesNS() {
    return this._packagesNS;
  }
}
