import camelCase = require("camelcase");
const debug = require('debug')('coge:environment:namespace');

// ============ | == @ ======== scope ========== | ====== unscoped ====== | = : ========== generator ========== | = @ ===== semver ====== @ | == + ========= instanceId =========== | = # ======= method ========= |= flags = |
const regexp = /^(?:(@[a-z0-9-~][a-z0-9-._~]*)\/)?([a-z0-9-~][a-z0-9-._~]*)(?::((?:[a-z0-9-~][a-z0-9-._~]*:?)*))?(?:@([a-z0-9-.~><+=^* ]*)@)?(?:\+((?:[a-z0-9-~][a-z0-9-._~]*\+?)*))?(?:#([a-z0-9-~][a-z0-9-._~]*))?(!|!\?|\?)?$/;

const groups = {complete: 0, scope: 1, unscoped: 2, generator: 3, semver: 4, instanceId: 5, method: 6, flags: 7};
const flags = {install: '!', load: '!?', optional: '?'};

export interface NamespaceProps {
  scope;
  unscoped;
  generator;
  instanceId;
  semver;
  method;
  flags;
}

export interface NamespaceOptions extends NamespaceProps {
  complete;
}

export interface NamespaceFlags {
  install?: boolean;
  load?: boolean;
  optional?: boolean;
}

export class CogeNamespace implements NamespaceProps, NamespaceFlags {
  protected _complete;
  protected _id;
  protected _namespace;
  flags;
  generator;
  instanceId;
  method;
  scope;
  semver;
  unscoped;

  install?: boolean;
  load?: boolean;
  optional?: boolean;

  constructor(parsed: NamespaceOptions) {
    this._complete = parsed.complete;
    this.scope = parsed.scope;
    this.unscoped = parsed.unscoped;
    this.generator = parsed.generator;
    this.instanceId = parsed.instanceId;
    this.semver = parsed.semver;
    this.method = parsed.method;
    this.flags = parsed.flags;

    // Populate flags
    if (this.flags) {
      Object.entries(flags).forEach(([name, value]) => {
        if (this.flags === value) {
          this[name] = true;
        } else {
          delete this[name];
        }
      });
    }

    debug('Parsed namespace %o', this);
  }

  static parse(complete): NamespaceOptions | undefined {
    const result = regexp.exec(complete);
    if (!result) {
      debug('Namespace failed RegExp parse %s, using fallback', complete);
      return;
    }

    const parsed = {complete};
    // Populate fields
    Object.entries(groups).forEach(([name, value]) => {
      if (result[value]) {
        parsed[name] = result[value];
      }
    });
    return <NamespaceOptions>parsed;
  }

  _update(parsed) {
    this.scope = parsed.scope || this.scope;
    this.unscoped = parsed.unscoped || this.unscoped;
    this.generator = parsed.generator || this.generator;
    this.instanceId = parsed.instanceId || this.instanceId;
    this.method = parsed.method || this.method;
    this.flags = parsed.flags || this.flags;
  }

  get _scopeAddition() {
    return this.scope ? `${this.scope}/` : '';
  }

  get _generatorAddition() {
    return this.generator ? `:${this.generator}` : '';
  }

  get _semverAddition() {
    return this.semver ? `@${this.semver}@` : '';
  }

  get _idAddition() {
    return this.instanceId ? `+${this.instanceId}` : '';
  }

  get complete() {
    return `${this.namespace}${this._semverAddition}${this._idAddition}${this.flags || ''}`;
  }

  get packageNamespace() {
    return `${this._scopeAddition}${this.unscoped}`;
  }

  get namespace() {
    return `${this.packageNamespace}${this._generatorAddition}`;
  }

  set namespace(namespace) {
    this._update(CogeNamespace.parse(namespace));
  }

  get id() {
    return `${this.namespace}${this._idAddition}`;
  }

  get generatorHint() {
    return `${this._scopeAddition}gen-${this.unscoped}`;
  }

  get versionedHint() {
    return this.semver ? `${this.generatorHint}@"${this.semver}"` : this.generatorHint;
  }

  get methodName() {
    return this.method ? `${camelCase(this.method)}#` : undefined;
  }

  bumpId() {
    if (!this.instanceId) {
      this.instanceId = '1';
      this._rebuildId();
      return;
    }
    const ids = this.instanceId.split('+');
    const id = ids.pop();
    if (isNaN(parseInt(id, 10)) || id.startsWith('0')) {
      ids.push(id);
      ids.push('1');
    } else {
      ids.push(String(parseInt(id, 10) + 1));
    }
    this.instanceId = ids.join('+');
    this._rebuildId();
  }

  protected _rebuildId() {
    delete this._namespace;
    delete this._id;
    delete this._complete;
  }
}


/**
 * Parse an namespace
 *
 * @private
 * @param  {String} namespace
 * @return {Object} parsed
 * @return {String} parsed.complete - Complete namespace
 * @return {String} parsed.namespace - CogeNamespace with format @scope/namespace:generator
 * @return {String} parsed.generatorHint - Package name
 * @return {String} parsed.id - Id of the instance.
 * @return {String} parsed.instanceId - Instance id with format @scope/namespace:generator+id
 * @return {String} parsed.scope - Scope name
 * @return {String} parsed.packageNamespace - Package namespace with format @scope/namespace
 * @return {String} parsed.generator - Original namespace
 * @return {String} parsed.flags - Original namespace
 */
export function parseNamespace(namespace: string) {
  const parsed = CogeNamespace.parse(namespace);
  return parsed ? new CogeNamespace(parsed) : null;
}

/**
 * Convert a namespace to a namespace object
 *
 * @private
 * @param  {String | CogeNamespace} namespace
 * @return {CogeNamespace}
 */
export function toNamespace(namespace: string | CogeNamespace) {
  return this.isNamespace(namespace) ? namespace : this.parseNamespace(namespace);
}

/**
 * Convert a namespace to a namespace object
 *
 * @private
 * @param  {String | CogeNamespace} namespace
 * @return {CogeNamespace}
 */
export function requireNamespace(namespace: string | CogeNamespace) {
  const parsed = this.toNamespace(namespace);
  if (!parsed) {
    throw new Error(`Error parsing namespace ${namespace}`);
  }
  return parsed;
}

/**
 * Test if the object is an CogeNamespace instance.
 *
 * @private
 * @param  {Object} namespace
 * @return {Boolean} True if namespace is a CogeNamespace
 */
export function isNamespace(namespace: Object) {
  return namespace && namespace.constructor && namespace.constructor.name === 'CogeNamespace';
}
