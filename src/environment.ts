import path = require("path");
import fs = require("fs-extra");
import untildify = require('untildify');
import isScoped = require('is-scoped');

import {findLast} from "@tib/utils/array/findLast";
import {uniq} from "@tib/utils/array/uniq";
import {sortBy} from "@tib/utils/array/sortBy";
import {last} from "@tib/utils/array/last";

import {PackageLookup, PackageLookupOptions, Resolver} from "./resolver";
import {PromptModule, TerminalAdapter} from "./adapter";
import {Store} from "./store";
import {ReadStream, WriteStream} from "tty";
import escapeRegExp from "@tib/utils/string/escapeRegExp";
import toArray from "@tib/utils/array/toArray";
import {Meta} from "./types";

const debug = require('debug')('coge:environment');

/**
 * Hint of generator module name
 */
function getGeneratorHint(namespace) {
  if (isScoped(namespace)) {
    const splitName = namespace.split('/');
    return `${splitName[0]}/gen-${splitName[1]}`;
  }
  return `gen-${namespace}`;
}

export interface EnvironmentOptions {
  prompt?: PromptModule;
  console?: Console;
  stdin?: ReadStream;
  stderr?: WriteStream;
  cwd?: string;
}

export interface LookupGeneratorOptions extends PackageLookupOptions {
  singleResult?: boolean;
  multiple?: boolean;
  packagePath?: boolean;
  generatorPath?: boolean;
}

export class Environment extends Resolver {
  static packageLookup = new PackageLookup();

  protected cwd: string;
  protected options: Partial<EnvironmentOptions>;
  adapter: TerminalAdapter;
  store: Store;

  static get lookups() {
    return ['.', 'generators', 'lib/generators'];
  }

  /**
   * Make sure the Environment present expected methods if an old version is
   * passed to a Generator.
   * @param  {Environment} env
   * @return {Environment} The updated env
   */
  static enforceUpdate(env) {
    if (!env.adapter) {
      env.adapter = new TerminalAdapter();
    }

    return env;
  }

  /**
   * Factory method to create an environment instance. Take same parameters as the
   * Environment constructor.
   *
   * @see This method take the same arguments as {@link Environment} constructor
   *
   * @return {Environment} a new Environment instance
   */
  static createEnv(opts?: EnvironmentOptions, adapter?: TerminalAdapter): Environment {
    return new Environment(opts, adapter);
  }

  /**
   * Convert a generators namespace to its name
   *
   * @param  {String} namespace
   * @return {String}
   */
  static namespaceToName(namespace) {
    return namespace.split(':')[0];
  }

  /**
   * Lookup for a specific generator.
   *
   * @param  {String} namespace
   * @param  {Object} [options]
   * @param {Boolean} [options.localOnly=false] - Set true to skip lookups of
   *                                                     globally-installed generators.
   * @param {Boolean} [options.packagePath=false] - Set true to return the package
   *                                                       path instead of generators file.
   * @param {Boolean} [options.singleResult=true] - Set false to return multiple values.
   * @return {String} generator
   */
  static lookupGenerator(namespace: string, options: Partial<LookupGeneratorOptions> | boolean = {singleResult: true}): string | string[] {
    let opts: LookupGeneratorOptions;
    if (typeof options === 'boolean') {
      opts = <LookupGeneratorOptions>{singleResult: true, localOnly: options};
    } else {
      // Keep compatibility with opts.multiple
      opts = <LookupGeneratorOptions>{singleResult: !options.multiple, ...options};
    }

    opts.filePatterns = opts.filePatterns || Environment.lookups.map(prefix => path.join(prefix, '*/template.toml'));

    const name = Environment.namespaceToName(namespace);
    opts.packagePatterns = opts.packagePatterns || getGeneratorHint(name);

    opts.npmPaths = opts.npmPaths || this.packageLookup.getNpmPaths(opts.localOnly).reverse();
    if (!Array.isArray(opts.npmPaths)) opts.npmPaths = [opts.npmPaths];
    opts.packagePatterns = opts.packagePatterns || 'gen-*';
    opts.packagePaths = opts.packagePaths || this.packageLookup.findPackagesIn(opts.npmPaths, opts);

    let paths: string[] = [];
    this.packageLookup.sync(opts, module => {
      const filename = module.filePath;
      const fileNS = this.namespace(filename, Environment.lookups);
      if (namespace === fileNS || (opts.packagePath && namespace === Environment.namespaceToName(fileNS))) {
        // Version 2.6.0 returned pattern instead of modulePath for opts.packagePath
        const returnPath = opts.packagePath ? module.packagePath : (opts.generatorPath ? path.posix.join(filename, '../../') : filename);
        paths.push(returnPath);
        if (opts.singleResult) {
          return true;
        }
      }
      return false;
    });

    return opts.singleResult ? paths[0] : paths;
  }

  /**
   * Given a String `filepath`, tries to figure out the relative namespace.
   *
   * ### Examples:
   *
   *     this.namespace('backbone/all/index.js');
   *     // => backbone:all
   *
   *     this.namespace('gen-backbone/model');
   *     // => backbone:model
   *
   *     this.namespace('backbone.js');
   *     // => backbone
   *
   *     this.namespace('gen-mocha/backbone/model/index.js');
   *     // => mocha:backbone:model
   *
   * @param {String} filepath
   * @param {Array} lookups paths
   */
  static namespace(filepath: string, lookups?: string[]) {
    if (!filepath) {
      throw new Error('Missing namespace');
    }
    lookups = toArray(lookups || []);

    // Cleanup extension and normalize path for different OS
    let ns = path.normalize(filepath.replace(new RegExp(escapeRegExp(path.extname(filepath)) + '$'), ''));

    // Sort lookups by length so biggest are removed first
    const nsLookups = sortBy(s => s.length, lookups.concat(['..'])).map(path.normalize).reverse();

    // If `ns` contains a lookup dir in its path, remove it.
    ns = nsLookups.reduce((ns, lookup) => {
      // Only match full directory (begin with leading slash or start of input, end with trailing slash)
      const reg = new RegExp(`(?:\\\\|/|^)${escapeRegExp(lookup)}(?=[\\\\|/])`, 'g');
      return ns.replace(reg, '');
    }, ns);

    const folders = ns.split(path.sep);
    const scope = findLast(folder => folder.indexOf('@') === 0, folders);

    // Cleanup `ns` from unwanted parts and then normalize slashes to `:`
    ns = ns
      .replace(/(.*gen-)/, '') // Remove before `gen-`
      .replace(/[/\\](coge|template|index|main)$/, '') // Remove `/coge`, `/template`, `/index` or `/main`
      .replace(/^[/\\]+/, '') // Remove leading `/`
      .replace(/[/\\]+/g, ':'); // Replace slashes by `:`

    if (scope) {
      ns = `${scope}/${ns}`;
    }

    debug('Resolve namespaces for %s: %s', filepath, ns);

    return ns;
  }


  /**
   * @classdesc `Environment` object is responsible of handling the lifecyle and bootstrap
   * of generators in a specific environment (your app).
   *
   * It provides a high-level API to create and run generators, as well as further
   * tuning where and how a generator is resolved.
   *
   * An environment is created using a list of `arguments` and a Hash of
   * `options`. Usually, this is the list of arguments you get back from your CLI
   * options parser.
   *
   * An optional adapter can be passed to provide interaction in non-CLI environment
   * (e.g. IDE plugins), otherwise a `TerminalAdapter` is instantiated by default
   *
   * @constructor
   * @param {Object}                opts
   * @param {Boolean} [opts.experimental]
   * @param {Object} [opts.sharedOptions]
   * @param {Console}      [opts.console]
   * @param {Stream}         [opts.stdin]
   * @param {Stream}        [opts.stdout]
   * @param {Stream}        [opts.stderr]
   * @param {TerminalAdapter} [adapter] - A TerminalAdapter instance or another object
   *                                     implementing this adapter interface. This is how
   *                                     you'd interface Yeoman with a GUI or an editor.
   */
  constructor(opts?: Partial<EnvironmentOptions>, adapter?: TerminalAdapter) {
    super();

    this.options = opts || {};
    const {prompt, console, stdin, stderr} = this.options;
    this.adapter = adapter || new TerminalAdapter({prompt, console, stdin, stderr});
    this.cwd = this.options.cwd || process.cwd();
    this.store = new Store();

    this.lookups = Environment.lookups;
    this.aliases = [];

    this.alias(/^([^:]+)$/, '$1:app');

  }

  /**
   * Registers a specific `generator` to this environment. This generator is stored under
   * provided namespace, or a default namespace format if none if available.
   *
   * @param  {String} name      - Filepath to the a generator or a npm package name
   * @param  {String} namespace - Namespace under which register the generator (optional)
   * @param  {String} packagePath - PackagePath to the generator npm package (optional)
   * @return {Object} environment - This environment
   */
  register(name: string, namespace?: string, packagePath?: string) {
    const modulePath = this.resolveModulePath(name);
    namespace = namespace || this.namespace(modulePath);

    if (!namespace) {
      throw new Error('Unable to determine namespace.');
    }

    // Generator is already registered and matches the current namespace.
    const meta = this.store.get(namespace);
    if (meta && meta.resolved === modulePath) {
      return this;
    }

    this.store.add(namespace, modulePath, packagePath);
    const packageNS = Environment.namespaceToName(namespace);
    this.store.addPackageNS(packageNS);
    if (packagePath) {
      this.store.addPackage(packageNS, packagePath);
    }

    debug('Registered %s (%s) on package %s (%s)', namespace, modulePath, packageNS, packagePath);
    return this;
  }

  /**
   * Returns the list of registered namespace.
   * @return {Array}
   */
  namespaces() {
    return this.store.namespaces();
  }

  /**
   * Returns stored generators meta
   * @return {Object}
   */
  getGenerators() {
    return this.store.getMetas();
  }

  /**
   * Get registered generators names
   *
   * @return {Array}
   */
  getGeneratorNames() {
    return uniq(Object.keys(this.getGenerators()).map(Environment.namespaceToName));
  }

  /**
   * Verify if a package namespace already have been registered.
   *
   * @param  {String} [packageNS] - namespace of the package.
   * @return {boolean} - true if any generator of the package has been registered
   */
  isPackageRegistered(packageNS) {
    return this.getRegisteredPackages().includes(packageNS);
  }

  /**
   * Get all registered packages namespaces.
   *
   * @return {Array} - array of namespaces.
   */
  getRegisteredPackages() {
    return this.store.getPackagesNS();
  }

  /**
   * Get last added path for a namespace
   *
   * @param  {String} namespace
   * @return {String} - path of the package
   */
  getPackagePath(namespace): string | undefined {
    if (namespace.includes(':')) {
      const generator = this.get(namespace);
      return generator?.packagePath;
    }
    const packagePaths = this.getPackagePaths(namespace) || [];
    return packagePaths[0];
  }

  /**
   * Get paths for a namespace
   *
   * @param  {String} namespace
   * @return  {Array} array of paths.
   */
  getPackagePaths(namespace) {
    return this.store.getPackagesPaths()[namespace] ||
      this.store.getPackagesPaths()[Environment.namespaceToName(this.alias(namespace))];
  }

  /**
   * Get a single generator from the registered list of generators. The lookup is
   * based on generator's namespace, "walking up" the namespaces until a matching
   * is found. Eg. if an `angular:common` namespace is registered, and we try to
   * get `angular:common:all` then we get `angular:common` as a fallback (unless
   * an `angular:common:all` generator is registered).
   *
   * @param  {String} namespaceOrPath
   * @return {Meta|null} - the generator registered under the namespace
   */
  get(namespaceOrPath?: string): Meta | undefined {
    // Stop the recursive search if nothing is left
    if (!namespaceOrPath) {
      return;
    }

    // const parsed = this.toNamespace ? this.toNamespace(namespaceOrPath) : undefined;
    // if (parsed && this.getByNamespace) {
    //   let generator = this.getByNamespace(parsed);
    //
    //   if (!generator && parsed.flags) {
    //     this.prepareEnvironment(parsed);
    //     generator = this.getByNamespace(parsed);
    //   }
    //
    //   return generator;
    // }

    let namespace = namespaceOrPath;

    const parts = namespaceOrPath.split(':');
    const maybePath = <string>last(parts);
    if (parts.length > 1 && /[/\\]/.test(maybePath)) {
      parts.pop();

      // We also want to remove the drive letter on windows
      if (maybePath.includes('\\') && last(parts)!.length === 1) {
        parts.pop();
      }

      namespace = parts.join(':');
    }

    return this.store.get(namespace) ||
      this.store.get(this.alias(namespace)) ||
      // Namespace is empty if namespaceOrPath contains a win32 absolute path of the form 'C:\path\to\generator'.
      // for this reason we pass namespaceOrPath to the getByPath function.
      this.getByPath(namespaceOrPath);
  }

  /**
   * Get a generator by path instead of namespace.
   * @param  {String} path
   * @return {Meta|null} - the generator found at the location
   */
  getByPath(path): Meta | undefined {
    if (fs.existsSync(path)) {
      const namespace = this.namespace(path);
      this.register(path, namespace);

      return this.get(namespace);
    }
  }

  /**
   * Given a String `filepath`, tries to figure out the relative namespace.
   *
   * ### Examples:
   *
   *     this.namespace('backbone/all/index.js');
   *     // => backbone:all
   *
   *     this.namespace('gen-backbone/model');
   *     // => backbone:model
   *
   *     this.namespace('backbone.js');
   *     // => backbone
   *
   *     this.namespace('gen-mocha/backbone/model/index.js');
   *     // => mocha:backbone:model
   *
   * @param {String} filepath
   * @param {Array} lookups paths
   */
  namespace(filepath, lookups = this.lookups) {
    return Environment.namespace(filepath, lookups);
  }

  /**
   * Resolve a module path
   * @param  {String} m - Filepath or module name
   * @return {String} - The resolved path leading to the module
   */
  resolveModulePath(m) {
    if (m[0] === '.') {
      m = path.resolve(m);
    }

    m = untildify(m);
    m = path.normalize(m);

    return m;
  }
}
