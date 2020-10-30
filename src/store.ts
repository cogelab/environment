import * as path from 'path';
import {Metas} from './types';

const debug = require('debug')('coge:environment:store');

/**
 * The Generator store
 * This is used to store generator (npm packages) reference and instantiate them when
 * requested.
 * @constructor
 * @private
 */
export class Store {
  _metas: Metas;
  _packagesPaths: {[name: string]: string[]};
  _packagesNS: string[];

  constructor() {
    this._metas = {};
    // Store packages paths by ns
    this._packagesPaths = {};
    // Store packages ns
    this._packagesNS = [];
  }

  /**
   * Store a module under the namespace key
   * @param {String} namespace  - The key under which the generator can be retrieved
   * @param {String} template  - The template file path
   * @param {String} packagePath - PackagePath to the generator npm package (optional)
   */
  add(namespace: string, template: string, packagePath?: string) {
    this._storeAsPath(namespace, template, packagePath);
  }

  _storeAsPath(namespace: string, template: string, packagePath?: string) {
    this._metas[namespace] = {
      resolved: template,
      namespace,
      packagePath,
      templateDir: path.dirname(template),
    };
  }

  /**
   * Get the module registered under the given namespace
   * @param  {String} namespace
   * @return {Module}
   */
  get(namespace: string) {
    return this._metas[namespace];
  }

  /**
   * Returns the list of registered namespace.
   * @return {Array} Namespaces array
   */
  namespaces() {
    return Object.keys(this._metas);
  }

  /**
   * Get the stored generators meta data
   * @return {Object} Generators metadata
   */
  getMetas() {
    return this._metas;
  }

  /**
   * Store a package under the namespace key
   * @param {String}     packageNS - The key under which the generator can be retrieved
   * @param {String}   packagePath - The package path
   */
  addPackage(packageNS: string | number, packagePath: string) {
    if (this._packagesPaths[packageNS]) {
      // Yo environment allows overriding, so the last added has preference.
      if (this._packagesPaths[packageNS][0] !== packagePath) {
        const packagePaths = this._packagesPaths[packageNS];
        debug(
          'Overriding a package with namespace %s and path %s, with path %s',
          packageNS,
          this._packagesPaths[packageNS][0],
          packagePath,
        );
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
  addPackageNS(packageNS: string) {
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
