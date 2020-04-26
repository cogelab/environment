import path = require("path");
import fs = require("fs-extra");
import untildify = require('untildify');
import isScoped = require('is-scoped');

import {findLast} from "@tiopkg/utils/array/findLast";
import {uniq} from "@tiopkg/utils/array/uniq";
import {sortBy} from "@tiopkg/utils/array/sortBy";
import {last} from "@tiopkg/utils/array/last";

import {PackageLookup, PackageLookupOptions, Resolver} from "./resolver";
import {TerminalAdapter} from "./adapter";
import {Store} from "./store";
import {ReadStream, WriteStream} from "tty";
import escapeRegExp from "@tiopkg/utils/string/escapeRegExp";
import toArray from "@tiopkg/utils/array/toArray";
import {Template} from "./types";

const debug = require('debug')('coge:environment');

/**
 * Hint of template module name
 */
function getTemplateHint(namespace) {
  if (isScoped(namespace)) {
    const splitName = namespace.split('/');
    return `${splitName[0]}/template-${splitName[1]}`;
  }
  return `template-${namespace}`;
}

export interface EnvironmentOptions {
  console?: Console;
  stdin?: ReadStream;
  stderr?: WriteStream;
  cwd?: string;
}

export interface LookupTemplateOptions extends PackageLookupOptions {
  singleResult?: boolean;
  multiple?: boolean;
  packagePath?: boolean;
  templatePath?: boolean;
}

export class Environment extends Resolver {
  static packageLookup = new PackageLookup();

  protected cwd: string;
  protected options: Partial<EnvironmentOptions>;
  adapter: TerminalAdapter;
  store: Store;

  static get lookups() {
    return ['.', 'templates', 'lib/templates'];
  }

  /**
   * Make sure the Environment present expected methods if an old version is
   * passed to a Template.
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
   * Convert a templates namespace to its name
   *
   * @param  {String} namespace
   * @return {String}
   */
  static namespaceToName(namespace) {
    return namespace.split(':')[0];
  }

  /**
   * Lookup for a specific template.
   *
   * @param  {String} namespace
   * @param  {Object} [options]
   * @param {Boolean} [options.localOnly=false] - Set true to skip lookups of
   *                                                     globally-installed templates.
   * @param {Boolean} [options.packagePath=false] - Set true to return the package
   *                                                       path instead of templates file.
   * @param {Boolean} [options.singleResult=true] - Set false to return multiple values.
   * @return {String} template
   */
  static lookupTemplate(namespace: string, options: Partial<LookupTemplateOptions> | boolean = {singleResult: true}): string | string[] {
    let opts: LookupTemplateOptions;
    if (typeof options === 'boolean') {
      opts = <LookupTemplateOptions>{singleResult: true, localOnly: options};
    } else {
      // Keep compatibility with opts.multiple
      opts = <LookupTemplateOptions>{singleResult: !options.multiple, ...options};
    }

    opts.filePatterns = opts.filePatterns || Environment.lookups.map(prefix => path.join(prefix, '*/template.toml'));

    const name = Environment.namespaceToName(namespace);
    opts.packagePatterns = opts.packagePatterns || getTemplateHint(name);

    opts.npmPaths = opts.npmPaths || this.packageLookup.getNpmPaths(opts.localOnly).reverse();
    if (!Array.isArray(opts.npmPaths)) opts.npmPaths = [opts.npmPaths];
    opts.packagePatterns = opts.packagePatterns || 'template-*';
    opts.packagePaths = opts.packagePaths || this.packageLookup.findPackagesIn(opts.npmPaths, opts);

    let paths: string[] = [];
    this.packageLookup.sync(opts, module => {
      const filename = module.filePath;
      const fileNS = this.namespace(filename, Environment.lookups);
      if (namespace === fileNS || (opts.packagePath && namespace === Environment.namespaceToName(fileNS))) {
        // Version 2.6.0 returned pattern instead of modulePath for opts.packagePath
        const returnPath = opts.packagePath ? module.packagePath : (opts.templatePath ? path.posix.join(filename, '../../') : filename);
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
   *     this.namespace('template-backbone/model');
   *     // => backbone:model
   *
   *     this.namespace('backbone.js');
   *     // => backbone
   *
   *     this.namespace('template-mocha/backbone/model/index.js');
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
      .replace(/(.*template-)/, '') // Remove before `template-`
      .replace(/[/\\](coge|template|index|main)$/, '') // Remove `/coge`, `template`, `/index` or `/main`
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
   * of templates in a specific environment (your app).
   *
   * It provides a high-level API to create and run templates, as well as further
   * tuning where and how a template is resolved.
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
    this.adapter = adapter || new TerminalAdapter({
      console: this.options.console,
      stdin: this.options.stdin,
      stderr: this.options.stderr
    });
    this.cwd = this.options.cwd || process.cwd();
    this.store = new Store();

    this.lookups = Environment.lookups;
    this.aliases = [];

    this.alias(/^([^:]+)$/, '$1:app');

  }

  /**
   * Registers a specific `template` to this environment. This template is stored under
   * provided namespace, or a default namespace format if none if available.
   *
   * @param  {String} name      - Filepath to the a template or a npm package name
   * @param  {String} namespace - Namespace under which register the template (optional)
   * @param  {String} packagePath - PackagePath to the template npm package (optional)
   * @return {Object} environment - This environment
   */
  register(name: string, namespace?: string, packagePath?: string) {
    const modulePath = this.resolveModulePath(name);
    namespace = namespace || this.namespace(modulePath);

    if (!namespace) {
      throw new Error('Unable to determine namespace.');
    }

    // Template is already registered and matches the current namespace.
    const tpl = this.store.get(namespace);
    if (tpl && tpl.resolved === modulePath) {
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
   * Returns stored templates meta
   * @return {Object}
   */
  getTemplates() {
    return this.store.getTemplates();
  }

  /**
   * Get registered templates names
   *
   * @return {Array}
   */
  getTemplateNames() {
    return uniq(Object.keys(this.getTemplates()).map(Environment.namespaceToName));
  }

  /**
   * Verify if a package namespace already have been registered.
   *
   * @param  {String} [packageNS] - namespace of the package.
   * @return {boolean} - true if any template of the package has been registered
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
      const template = this.get(namespace);
      return template?.packagePath;
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
   * Get a single template from the registered list of templates. The lookup is
   * based on template's namespace, "walking up" the namespaces until a matching
   * is found. Eg. if an `angular:common` namespace is registered, and we try to
   * get `angular:common:all` then we get `angular:common` as a fallback (unless
   * an `angular:common:all` template is registered).
   *
   * @param  {String} namespaceOrPath
   * @return {Template|null} - the template registered under the namespace
   */
  get(namespaceOrPath?: string): Template | undefined {
    // Stop the recursive search if nothing is left
    if (!namespaceOrPath) {
      return;
    }

    // const parsed = this.toNamespace ? this.toNamespace(namespaceOrPath) : undefined;
    // if (parsed && this.getByNamespace) {
    //   let template = this.getByNamespace(parsed);
    //
    //   if (!template && parsed.flags) {
    //     this.prepareEnvironment(parsed);
    //     template = this.getByNamespace(parsed);
    //   }
    //
    //   return template;
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
      // Namespace is empty if namespaceOrPath contains a win32 absolute path of the form 'C:\path\to\template'.
      // for this reason we pass namespaceOrPath to the getByPath function.
      this.getByPath(namespaceOrPath);
  }

  /**
   * Get a template by path instead of namespace.
   * @param  {String} path
   * @return {Template|null} - the template found at the location
   */
  getByPath(path): Template | undefined {
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
   *     this.namespace('template-backbone/model');
   *     // => backbone:model
   *
   *     this.namespace('backbone.js');
   *     // => backbone
   *
   *     this.namespace('template-mocha/backbone/model/index.js');
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
