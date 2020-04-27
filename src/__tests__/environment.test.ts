import path = require('path');
import assert = require('yeoman-assert');

import {TerminalAdapter} from '../adapter';
import {Environment} from '../environment';
import {assertGenerator} from "./support";

describe('Environment', () => {
  let env: Environment;

  beforeEach(function () {
    env = new Environment();
  });

  describe('constructor', () => {
    it('take options parameter', () => {
      const opts = {foo: 'bar'};
      // @ts-ignore
      assert.equal(new Environment(opts).options, opts);
    });

    it('uses the provided object as adapter if any', () => {
      const dummyAdapter = new TerminalAdapter();
      const env = new Environment(undefined, dummyAdapter);
      assert.equal(env.adapter, dummyAdapter, 'Not the adapter provided');
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
      assert.equal(env.namespaces().length, 0, 'env should be empty');
      env
        .register(simplePath, 'fixtures:gen-simple', simplePath)
        .register(extendPath, 'scaffold');
    });

    it('store registered generators', function () {
      assert.equal(env.namespaces().length, 2);
    });

    it('determine registered Generator namespace and resolved path', function () {
      const simple = env.get('fixtures:gen-simple');
      assert.ok(simple);
      assert.ok(simple!.namespace, 'fixtures:gen-simple');
      assert.ok(simple!.resolved, path.resolve(simplePath));
      assert.ok(simple!.packagePath, simplePath);

      const extend = env.get('scaffold');
      assert.ok(extend);
      assert.ok(extend!.namespace, 'scaffold');
      assert.ok(extend!.resolved, path.resolve(extendPath));
    });

    it('throw when String is not passed as first parameter', () => {
      assert.throws(function () {
        // @ts-ignore
        env.register(() => {
        }, 'blop');
      });
      assert.throws(function () {
        // @ts-ignore
        env.register([], 'blop');
      });
      assert.throws(function () {
        // @ts-ignore
        env.register(false, 'blop');
      });
    });
  });

  describe('#getPackagePath and #getPackagePaths()', () => {

    let simplePath: string;

    beforeEach(function () {
      env.alias(/^prefix-(.*)$/, '$1');
      simplePath = path.join(__dirname, 'fixtures/gen-simple');
      assert.equal(env.namespaces().length, 0, 'env should be empty');
      env
        .register(simplePath, 'fixtures:gen-simple', simplePath)
        .register(simplePath, 'fixtures2', simplePath)
        .register(simplePath, 'fixtures:gen-simple2', 'new-path');
    });

    it('determine registered Generator namespace and resolved path', function () {
      assert.equal(env.getPackagePath('fixtures:gen-simple'), simplePath);
      assert.equal(env.getPackagePath('fixtures'), 'new-path');
      // With alias
      assert.equal(env.getPackagePath('prefix-fixtures:gen-simple'), env.getPackagePath('fixtures:gen-simple'));
      assert.equal(env.getPackagePath('prefix-fixtures'), env.getPackagePath('fixtures'));
      assert.deepEqual(env.getPackagePaths('prefix-fixtures'), env.getPackagePaths('fixtures'));
    });
  });

  describe('#namespaces()', () => {
    beforeEach(function () {
      env
        .register(path.join(__dirname, './fixtures/gen-simple'))
        .register(path.join(__dirname, './fixtures/gen-extend/support'))
        .register(path.join(__dirname, './fixtures/gen-extend/support'), 'support:scaffold');
    });

    it('get the list of namespaces', function () {
      assert.deepEqual(env.namespaces(), ['simple', 'extend:support', 'support:scaffold']);
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
      assert.deepEqual(meta.resolved, generatorPath);
      assert.deepEqual(meta.namespace, 'simple');
    });
  });

  describe('#getGeneratorNames', () => {
    let generatorPath: string;

    beforeEach(function () {
      generatorPath = path.join(__dirname, './fixtures/gen-simple');
      env.register(generatorPath);
    });

    it('get the registered generators names', function () {
      assert.deepEqual(env.getGeneratorNames(), ['simple']);
    });
  });

  describe('#namespace()', () => {
    it('create namespace from path', function () {
      assert.equal(env.namespace('backbone/all/index.js'), 'backbone:all');
      assert.equal(env.namespace('backbone/all/main.js'), 'backbone:all');
      assert.equal(env.namespace('backbone/all'), 'backbone:all');
      assert.equal(env.namespace('backbone/all.js'), 'backbone:all');
      assert.equal(env.namespace('backbone/app/index.js'), 'backbone:app');
      assert.equal(env.namespace('backbone.js'), 'backbone');

      assert.equal(env.namespace('gen-backbone/all.js'), 'backbone:all');
      assert.equal(env.namespace('gen-mocha/backbone/model/index.js'), 'mocha:backbone:model');
      assert.equal(env.namespace('gen-mocha/backbone/model.js'), 'mocha:backbone:model');
      assert.equal(env.namespace('node_modules/gen-mocha/backbone/model.js'), 'mocha:backbone:model');
    });

    it('create namespace from scoped path', function () {
      assert.equal(env.namespace('@dummyscope/gen-backbone/all.js'), '@dummyscope/backbone:all');
      assert.equal(env.namespace('@dummyscope/gen-mocha/backbone/model/index.js'), '@dummyscope/mocha:backbone:model');
      assert.equal(env.namespace('@dummyscope/gen-mocha/backbone/model.js'), '@dummyscope/mocha:backbone:model');
      assert.equal(env.namespace('/node_modules/@dummyscope/gen-mocha/backbone/model.js'), '@dummyscope/mocha:backbone:model');
    });

    it('handle relative paths', function () {
      assert.equal(env.namespace('../local/stuff'), 'local:stuff');
      assert.equal(env.namespace('./local/stuff'), 'local:stuff');
      assert.equal(env.namespace('././local/stuff'), 'local:stuff');
      assert.equal(env.namespace('../../local/stuff'), 'local:stuff');
    });

    it('handles weird paths', function () {
      assert.equal(env.namespace('////gen/all'), 'gen:all');
      assert.equal(env.namespace('gen-backbone///all.js'), 'backbone:all');
      assert.equal(env.namespace('gen-backbone/././all.js'), 'backbone:all');
      assert.equal(env.namespace('gen-backbone/gen-backbone/all.js'), 'backbone:all');
    });

    it('works with Windows\' paths', function () {
      assert.equal(env.namespace('backbone\\all\\main.js'), 'backbone:all');
      assert.equal(env.namespace('backbone\\all'), 'backbone:all');
      assert.equal(env.namespace('backbone\\all.js'), 'backbone:all');
    });

    it('remove lookups from namespace', function () {
      assert.equal(env.namespace('backbone/generators/all/index.js'), 'backbone:all');
      assert.equal(env.namespace('backbone/lib/generators/all/index.js'), 'backbone:all');
      assert.equal(env.namespace('some-lib/generators/all/index.js'), 'some-lib:all');
      assert.equal(env.namespace('my.thing/generators/app/index.js'), 'my.thing:app');
      assert.equal(env.namespace('meta/generators/generators-thing/index.js'), 'meta:generators-thing');
    });

    it('remove path before the generator name', function () {
      assert.equal(env.namespace('/Users/yeoman/.nvm/v0.10.22/lib/node_modules/gen-backbone/all/index.js'), 'backbone:all');
      assert.equal(env.namespace('/usr/lib/node_modules/gen-backbone/all/index.js'), 'backbone:all');
    });

    it('handle paths when multiples lookups are in it', function () {
      assert.equal(
        env.namespace('c:\\projects\\yeoman\\generators\\gen-example\\generators\\app\\index.js'),
        'example:app'
      );
    });

    it('handles namespaces', function () {
      assert.equal(env.namespace('backbone:app'), 'backbone:app');
      assert.equal(env.namespace('foo'), 'foo');
    });
  });

  describe('#get()', () => {
    const generator = path.resolve(path.join(__dirname, './fixtures/gen-mocha'));

    beforeEach(function () {
      env
        .register(generator, 'mocha:generator')
        .register(generator, 'fixtures:gen-mocha');
    });

    it('get a specific generator', function () {
      assertGenerator(env.get('mocha:generator'), generator);
      assertGenerator(env.get('fixtures:gen-mocha'), generator);
    });

    it('remove paths from namespace at resolution (for backward compatibility)', function () {
      assertGenerator(env.get('mocha:generator:/a/dummy/path/'), generator);
      assertGenerator(env.get('mocha:generator:C:\\foo\\bar'), generator);
    });

    it('fallback to requiring generator from a file path', function () {
      assertGenerator(
        env.get(path.join(__dirname, './fixtures/gen-mocha')),
        generator
      );
    });

    it('returns undefined if namespace is not found', function () {
      assert.equal(env.get('not:there'), undefined);
      assert.equal(env.get(), undefined);
    });

    it('works with modules', function () {
      env.register(path.join(__dirname, './fixtures/gen-module/generators/app'), 'fixtures:gen-module');
      assertGenerator(env.get('fixtures:gen-module'), path.join(__dirname, './fixtures/gen-module/generators/app'));
    });
  });

  describe('#alias()', () => {
    it('apply regex and replace with alternative value', function () {
      env.alias(/^([^:]+)$/, '$1:app');
      assert.equal(env.alias('foo'), 'foo:app');
    });

    it('apply multiple regex', function () {
      env.alias(/^([a-zA-Z0-9:*]+)$/, 'gen-$1');
      env.alias(/^([^:]+)$/, '$1:app');
      assert.equal(env.alias('foo'), 'gen-foo:app');
    });

    it('apply latest aliases first', function () {
      env.alias(/^([^:]+)$/, '$1:all');
      env.alias(/^([^:]+)$/, '$1:app');
      assert.equal(env.alias('foo'), 'foo:app');
    });

    it('alias empty namespace to `:app` by default', function () {
      assert.equal(env.alias('foo'), 'foo:app');
    });

    it('alias removing prefix- from namespaces', function () {
      env.alias(/^(@.*\/)?prefix-(.*)$/, '$1$2');
      assert.equal(env.alias('prefix-foo'), 'foo:app');
      assert.equal(env.alias('prefix-mocha:generator'), 'mocha:generator');
      assert.equal(env.alias('prefix-fixtures:gen-mocha'), 'fixtures:gen-mocha');
      assert.equal(env.alias('@scoped/prefix-fixtures:gen-mocha'), '@scoped/fixtures:gen-mocha');
    });
  });

  describe('#get() with #alias()', () => {
    let generator;
    beforeEach(function () {
      generator = path.join(__dirname, './fixtures/gen-mocha');
      env.alias(/^prefix-(.*)$/, '$1');
      env
        .register(generator, 'fixtures:gen-mocha')
        .register(generator, 'mocha:generator');
    });

    it('get a specific generator', function () {
      assertGenerator(env.get('prefix-mocha:generator'), generator);
      assertGenerator(env.get('mocha:generator'), generator);
      assertGenerator(env.get('prefix-fixtures:gen-mocha'), generator);
      assertGenerator(env.get('fixtures:gen-mocha'), generator);
    });
  });

  describe('.enforceUpdate()', () => {
    beforeEach(function () {
      env = new Environment();
      delete env.adapter;
    });

    it('add an adapter', function () {
      Environment.enforceUpdate(env);
      assert(env.adapter);
    });
  });

  describe('.createEnv()', () => {
    it('create an environment', () => {
      const env = Environment.createEnv();
      assert(env instanceof Environment);
    });
  });

  describe('.namespaceToName()', () => {
    it('convert a namespace to a name', () => {
      const name = Environment.namespaceToName('mocha:generator');
      assert.equal(name, 'mocha');
    });
  });
});
