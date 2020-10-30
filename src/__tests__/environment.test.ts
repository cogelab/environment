import path = require('path');

import {TerminalAdapter} from '../adapter';
import {Environment} from '../environment';
import {assertGenerator} from './support';

describe('Environment', () => {
  let env: Environment;

  beforeEach(function () {
    env = new Environment();
  });

  describe('constructor', () => {
    it('take options parameter', () => {
      const opts = {foo: 'bar'};

      expect(new Environment(opts as any).options).toBe(opts);
    });

    it('uses the provided object as adapter if any', () => {
      const dummyAdapter = new TerminalAdapter();
      const e = new Environment(undefined, dummyAdapter);
      expect(e.adapter).toBe(dummyAdapter);
    });
  });

  // describe.skip('#registerModulePath()', () => {
  //   it('resolves to a directory if no file type specified', function () {
  //     const modulePath = path.join(__dirname, 'fixtures/gen-scoped/package');
  //     const specifiedJS = path.join(__dirname, 'fixtures/gen-scoped/package/index.js');
  //     const specifiedJSON = path.join(__dirname, 'fixtures/gen-scoped/package.json');
  //     const specifiedNode = path.join(__dirname, 'fixtures/gen-scoped/package/nodefile.node');
  //
  //     assert.equal(specifiedJS, env.resolveModulePath(modulePath));
  //     assert.equal(specifiedJS, env.resolveModulePath(specifiedJS));
  //     assert.equal(specifiedJSON, env.resolveModulePath(specifiedJSON));
  //     assert.equal(specifiedNode, env.resolveModulePath(specifiedNode));
  //
  //     const aModulePath = path.join(__dirname, 'fixtures/gen-scoped/app');
  //     const aSpecifiedJS = path.join(__dirname, 'fixtures/gen-scoped/app/index.js');
  //     assert.equal(aSpecifiedJS, env.resolveModulePath(aModulePath));
  //   });
  // });

  describe('#register()', () => {
    let simplePath: string;
    let extendPath: string;

    beforeEach(function () {
      simplePath = path.join(__dirname, 'fixtures/gen-simple');
      extendPath = path.join(__dirname, './fixtures/gen-extend/support');
      expect(env.namespaces().length).toBe(0);
      env
        .register(simplePath, 'fixtures:gen-simple', simplePath)
        .register(extendPath, 'scaffold');
    });

    it('store registered generators', function () {
      expect(env.namespaces().length).toBe(2);
    });

    it('determine registered Generator namespace and resolved path', function () {
      const simple = env.get('fixtures:gen-simple');
      expect(simple).toBeTruthy();
      expect(simple!.namespace).toBeTruthy();
      expect(simple!.resolved).toBeTruthy();
      expect(simple!.packagePath).toBeTruthy();

      const extend = env.get('scaffold');
      expect(extend).toBeTruthy();
      expect(extend!.namespace).toBeTruthy();
      expect(extend!.resolved).toBeTruthy();
    });

    it('throw when String is not passed as first parameter', () => {
      expect(function () {
        env.register((() => {}) as any, 'blop');
      }).toThrow();
      expect(function () {
        env.register([] as any, 'blop');
      }).toThrow();
      expect(function () {
        env.register(false as any, 'blop');
      }).toThrow();
    });
  });

  describe('#getPackagePath and #getPackagePaths()', () => {
    let simplePath: string;

    beforeEach(function () {
      env.alias(/^prefix-(.*)$/, '$1');
      simplePath = path.join(__dirname, 'fixtures/gen-simple');
      expect(env.namespaces().length).toBe(0);
      env
        .register(simplePath, 'fixtures:gen-simple', simplePath)
        .register(simplePath, 'fixtures2', simplePath)
        .register(simplePath, 'fixtures:gen-simple2', 'new-path');
    });

    it('determine registered Generator namespace and resolved path', function () {
      expect(env.getPackagePath('fixtures:gen-simple')).toBe(simplePath);
      expect(env.getPackagePath('fixtures')).toBe('new-path');
      // With alias
      expect(env.getPackagePath('prefix-fixtures:gen-simple')).toBe(
        env.getPackagePath('fixtures:gen-simple'),
      );
      expect(env.getPackagePath('prefix-fixtures')).toBe(
        env.getPackagePath('fixtures'),
      );
      expect(env.getPackagePaths('prefix-fixtures')).toEqual(
        env.getPackagePaths('fixtures'),
      );
    });
  });

  describe('#namespaces()', () => {
    beforeEach(function () {
      env
        .register(path.join(__dirname, './fixtures/gen-simple'))
        .register(path.join(__dirname, './fixtures/gen-extend/support'))
        .register(
          path.join(__dirname, './fixtures/gen-extend/support'),
          'support:scaffold',
        );
    });

    it('get the list of namespaces', function () {
      expect(env.namespaces()).toEqual([
        'simple',
        'extend:support',
        'support:scaffold',
      ]);
    });
  });

  describe('#getGeneratorsMeta()', () => {
    let generatorPath: string;

    beforeEach(function () {
      generatorPath = path.join(__dirname, './fixtures/gen-simple');
      env.register(generatorPath);
    });

    it('get the registered Generators metadatas', function () {
      const meta = env.getGenerators().simple;
      expect(meta.resolved).toEqual(generatorPath);
      expect(meta.namespace).toEqual('simple');
    });
  });

  describe('#getGeneratorNames', () => {
    let generatorPath: string;

    beforeEach(function () {
      generatorPath = path.join(__dirname, './fixtures/gen-simple');
      env.register(generatorPath);
    });

    it('get the registered generators names', function () {
      expect(env.getGeneratorNames()).toEqual(['simple']);
    });
  });

  describe('#namespace()', () => {
    it('create namespace from path', function () {
      expect(env.namespace('backbone/all/index.js')).toBe('backbone:all');
      expect(env.namespace('backbone/all/main.js')).toBe('backbone:all');
      expect(env.namespace('backbone/all')).toBe('backbone:all');
      expect(env.namespace('backbone/all.js')).toBe('backbone:all');
      expect(env.namespace('backbone/app/index.js')).toBe('backbone:app');
      expect(env.namespace('backbone.js')).toBe('backbone');

      expect(env.namespace('gen-backbone/all.js')).toBe('backbone:all');
      expect(env.namespace('gen-mocha/backbone/model/index.js')).toBe(
        'mocha:backbone:model',
      );
      expect(env.namespace('gen-mocha/backbone/model.js')).toBe(
        'mocha:backbone:model',
      );
      expect(env.namespace('node_modules/gen-mocha/backbone/model.js')).toBe(
        'mocha:backbone:model',
      );
      expect(env.namespace('../node_modules/gen-mocha/backbone/model.js')).toBe(
        'mocha:backbone:model',
      );
      expect(env.namespace('../gen-mocha/backbone/model.js')).toBe(
        'mocha:backbone:model',
      );
    });

    it('create namespace from scoped path', function () {
      expect(env.namespace('@dummyscope/gen-backbone/all.js')).toBe(
        '@dummyscope/backbone:all',
      );
      expect(
        env.namespace('@dummyscope/gen-mocha/backbone/model/index.js'),
      ).toBe('@dummyscope/mocha:backbone:model');
      expect(env.namespace('@dummyscope/gen-mocha/backbone/model.js')).toBe(
        '@dummyscope/mocha:backbone:model',
      );
      expect(
        env.namespace('/node_modules/@dummyscope/gen-mocha/backbone/model.js'),
      ).toBe('@dummyscope/mocha:backbone:model');
    });

    it('handle relative paths', function () {
      expect(env.namespace('../local/stuff')).toBe('local:stuff');
      expect(env.namespace('./local/stuff')).toBe('local:stuff');
      expect(env.namespace('././local/stuff')).toBe('local:stuff');
      expect(env.namespace('../../local/stuff')).toBe('local:stuff');
    });

    it('handles weird paths', function () {
      expect(env.namespace('////gen/all')).toBe('gen:all');
      expect(env.namespace('gen-backbone///all.js')).toBe('backbone:all');
      expect(env.namespace('gen-backbone/././all.js')).toBe('backbone:all');
      expect(env.namespace('gen-backbone/gen-backbone/all.js')).toBe(
        'backbone:all',
      );
    });

    it("works with Windows' paths", function () {
      expect(env.namespace('backbone\\all\\main.js')).toBe('backbone:all');
      expect(env.namespace('backbone\\all')).toBe('backbone:all');
      expect(env.namespace('backbone\\all.js')).toBe('backbone:all');
    });

    it('remove lookups from namespace', function () {
      expect(env.namespace('backbone/generators/all/index.js')).toBe(
        'backbone:all',
      );
      expect(env.namespace('backbone/lib/generators/all/index.js')).toBe(
        'backbone:all',
      );
      expect(env.namespace('some-lib/generators/all/index.js')).toBe(
        'some-lib:all',
      );
      expect(env.namespace('my.thing/generators/app/index.js')).toBe(
        'my.thing:app',
      );
      expect(env.namespace('meta/generators/generators-thing/index.js')).toBe(
        'meta:generators-thing',
      );
    });

    it('remove path before the generator name', function () {
      expect(
        env.namespace(
          '/Users/yeoman/.nvm/v0.10.22/lib/node_modules/gen-backbone/all/index.js',
        ),
      ).toBe('backbone:all');
      expect(
        env.namespace('/usr/lib/node_modules/gen-backbone/all/index.js'),
      ).toBe('backbone:all');
    });

    it('handle paths when multiples lookups are in it', function () {
      expect(
        env.namespace(
          'c:\\projects\\yeoman\\generators\\gen-example\\generators\\app\\index.js',
        ),
      ).toBe('example:app');
    });

    it('handles namespaces', function () {
      expect(env.namespace('backbone:app')).toBe('backbone:app');
      expect(env.namespace('foo')).toBe('foo');
    });
  });

  describe('#get()', () => {
    const generator = path.resolve(
      path.join(__dirname, './fixtures/gen-mocha'),
    );

    beforeEach(function () {
      env
        .register(generator, 'mocha:generator')
        .register(generator, 'fixtures:gen-mocha');
    });

    it('get a specific generator', function () {
      assertGenerator(env.get('mocha:generator')!, generator);
      assertGenerator(env.get('fixtures:gen-mocha')!, generator);
    });

    it('remove paths from namespace at resolution (for backward compatibility)', function () {
      assertGenerator(env.get('mocha:generator:/a/dummy/path/')!, generator);
      assertGenerator(env.get('mocha:generator:C:\\foo\\bar')!, generator);
    });

    it('fallback to requiring generator from a file path', function () {
      assertGenerator(
        env.get(path.join(__dirname, './fixtures/gen-mocha'))!,
        generator,
      );
    });

    it('returns undefined if namespace is not found', function () {
      expect(env.get('not:there')).toBe(undefined);
      expect(env.get()).toBe(undefined);
    });

    it('works with modules', function () {
      env.register(
        path.join(__dirname, './fixtures/gen-module/generators/app'),
        'fixtures:gen-module',
      );
      assertGenerator(
        env.get('fixtures:gen-module')!,
        path.join(__dirname, './fixtures/gen-module/generators/app'),
      );
    });
  });

  describe('#alias()', () => {
    it('apply regex and replace with alternative value', function () {
      env.alias(/^([^:]+)$/, '$1:app');
      expect(env.alias('foo')).toBe('foo:app');
    });

    it('apply multiple regex', function () {
      env.alias(/^([a-zA-Z0-9:*]+)$/, 'gen-$1');
      env.alias(/^([^:]+)$/, '$1:app');
      expect(env.alias('foo')).toBe('gen-foo:app');
    });

    it('apply latest aliases first', function () {
      env.alias(/^([^:]+)$/, '$1:all');
      env.alias(/^([^:]+)$/, '$1:app');
      expect(env.alias('foo')).toBe('foo:app');
    });

    it('alias empty namespace to `:app` by default', function () {
      expect(env.alias('foo')).toBe('foo:app');
    });

    it('alias removing prefix- from namespaces', function () {
      env.alias(/^(@.*\/)?prefix-(.*)$/, '$1$2');
      expect(env.alias('prefix-foo')).toBe('foo:app');
      expect(env.alias('prefix-mocha:generator')).toBe('mocha:generator');
      expect(env.alias('prefix-fixtures:gen-mocha')).toBe('fixtures:gen-mocha');
      expect(env.alias('@scoped/prefix-fixtures:gen-mocha')).toBe(
        '@scoped/fixtures:gen-mocha',
      );
    });
  });

  describe('#get() with #alias()', () => {
    let generator: string;
    beforeEach(function () {
      generator = path.join(__dirname, './fixtures/gen-mocha');
      env.alias(/^prefix-(.*)$/, '$1');
      env
        .register(generator, 'fixtures:gen-mocha')
        .register(generator, 'mocha:generator');
    });

    it('get a specific generator', function () {
      assertGenerator(env.get('prefix-mocha:generator')!, generator);
      assertGenerator(env.get('mocha:generator')!, generator);
      assertGenerator(env.get('prefix-fixtures:gen-mocha')!, generator);
      assertGenerator(env.get('fixtures:gen-mocha')!, generator);
    });
  });

  describe('.enforceUpdate()', () => {
    beforeEach(function () {
      env = new Environment();
      delete env.adapter;
    });

    it('add an adapter', function () {
      Environment.enforceUpdate(env);
      expect(env.adapter).toBeTruthy();
    });
  });

  describe('.createEnv()', () => {
    it('create an environment', () => {
      const e = Environment.createEnv();
      expect(e instanceof Environment).toBeTruthy();
    });
  });

  describe('.namespaceToName()', () => {
    it('convert a namespace to a name', () => {
      const name = Environment.namespaceToName('mocha:generator');
      expect(name).toBe('mocha');
    });
  });
});
