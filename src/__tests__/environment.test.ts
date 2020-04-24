import path = require('path');
import assert = require('yeoman-assert');

import {TerminalAdapter} from '../adapter';
import {Environment} from '../environment';
import {assertTemplate} from "./support";

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
  //     const modulePath = path.join(__dirname, 'fixtures/template-scoped/package');
  //     const specifiedJS = path.join(__dirname, 'fixtures/template-scoped/package/index.js');
  //     const specifiedJSON = path.join(__dirname, 'fixtures/template-scoped/package.json');
  //     const specifiedNode = path.join(__dirname, 'fixtures/template-scoped/package/nodefile.node');
  //
  //     assert.equal(specifiedJS, env.resolveModulePath(modulePath));
  //     assert.equal(specifiedJS, env.resolveModulePath(specifiedJS));
  //     assert.equal(specifiedJSON, env.resolveModulePath(specifiedJSON));
  //     assert.equal(specifiedNode, env.resolveModulePath(specifiedNode));
  //
  //     const aModulePath = path.join(__dirname, 'fixtures/template-scoped/app');
  //     const aSpecifiedJS = path.join(__dirname, 'fixtures/template-scoped/app/index.js');
  //     assert.equal(aSpecifiedJS, env.resolveModulePath(aModulePath));
  //   });
  // });

  describe('#register()', () => {
    let simplePath: string;
    let extendPath: string;

    beforeEach(function () {
      simplePath = path.join(__dirname, 'fixtures/template-simple');
      extendPath = path.join(__dirname, './fixtures/template-extend/support');
      assert.equal(env.namespaces().length, 0, 'env should be empty');
      env
        .register(simplePath, 'fixtures:template-simple', simplePath)
        .register(extendPath, 'scaffold');
    });

    it('store registered templates', function () {
      assert.equal(env.namespaces().length, 2);
    });

    it('determine registered Template namespace and resolved path', function () {
      const simple = env.get('fixtures:template-simple');
      assert.ok(simple);
      assert.ok(simple.namespace, 'fixtures:template-simple');
      assert.ok(simple.resolved, path.resolve(simplePath));
      assert.ok(simple.packagePath, simplePath);

      const extend = env.get('scaffold');
      assert.ok(extend);
      assert.ok(extend.namespace, 'scaffold');
      assert.ok(extend.resolved, path.resolve(extendPath));
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
      simplePath = path.join(__dirname, 'fixtures/template-simple');
      assert.equal(env.namespaces().length, 0, 'env should be empty');
      env
        .register(simplePath, 'fixtures:template-simple', simplePath)
        .register(simplePath, 'fixtures2', simplePath)
        .register(simplePath, 'fixtures:template-simple2', 'new-path');
    });

    it('determine registered Template namespace and resolved path', function () {
      assert.equal(env.getPackagePath('fixtures:template-simple'), simplePath);
      assert.equal(env.getPackagePath('fixtures'), 'new-path');
      // With alias
      assert.equal(env.getPackagePath('prefix-fixtures:template-simple'), env.getPackagePath('fixtures:template-simple'));
      assert.equal(env.getPackagePath('prefix-fixtures'), env.getPackagePath('fixtures'));
      assert.deepEqual(env.getPackagePaths('prefix-fixtures'), env.getPackagePaths('fixtures'));
    });
  });

  describe('#namespaces()', () => {
    beforeEach(function () {
      env
        .register(path.join(__dirname, './fixtures/template-simple'))
        .register(path.join(__dirname, './fixtures/template-extend/support'))
        .register(path.join(__dirname, './fixtures/template-extend/support'), 'support:scaffold');
    });

    it('get the list of namespaces', function () {
      assert.deepEqual(env.namespaces(), ['simple', 'extend:support', 'support:scaffold']);
    });
  });

  describe('#getTemplatesMeta()', () => {
    let templatePath: string;

    beforeEach(function () {
      templatePath = path.join(__dirname, './fixtures/template-simple');
      env.register(templatePath);
    });

    it('get the registered Templates metadatas', function () {
      const meta = env.getTemplatesMeta().simple;
      assert.deepEqual(meta.resolved, templatePath);
      assert.deepEqual(meta.namespace, 'simple');
    });
  });

  describe('#getTemplateNames', () => {
    let templatePath: string;

    beforeEach(function () {
      templatePath = path.join(__dirname, './fixtures/template-simple');
      env.register(templatePath);
    });

    it('get the registered templates names', function () {
      assert.deepEqual(env.getTemplateNames(), ['simple']);
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

      assert.equal(env.namespace('template-backbone/all.js'), 'backbone:all');
      assert.equal(env.namespace('template-mocha/backbone/model/index.js'), 'mocha:backbone:model');
      assert.equal(env.namespace('template-mocha/backbone/model.js'), 'mocha:backbone:model');
      assert.equal(env.namespace('node_modules/template-mocha/backbone/model.js'), 'mocha:backbone:model');
    });

    it('create namespace from scoped path', function () {
      assert.equal(env.namespace('@dummyscope/template-backbone/all.js'), '@dummyscope/backbone:all');
      assert.equal(env.namespace('@dummyscope/template-mocha/backbone/model/index.js'), '@dummyscope/mocha:backbone:model');
      assert.equal(env.namespace('@dummyscope/template-mocha/backbone/model.js'), '@dummyscope/mocha:backbone:model');
      assert.equal(env.namespace('/node_modules/@dummyscope/template-mocha/backbone/model.js'), '@dummyscope/mocha:backbone:model');
    });

    it('handle relative paths', function () {
      assert.equal(env.namespace('../local/stuff'), 'local:stuff');
      assert.equal(env.namespace('./local/stuff'), 'local:stuff');
      assert.equal(env.namespace('././local/stuff'), 'local:stuff');
      assert.equal(env.namespace('../../local/stuff'), 'local:stuff');
    });

    it('handles weird paths', function () {
      assert.equal(env.namespace('////gen/all'), 'gen:all');
      assert.equal(env.namespace('template-backbone///all.js'), 'backbone:all');
      assert.equal(env.namespace('template-backbone/././all.js'), 'backbone:all');
      assert.equal(env.namespace('template-backbone/template-backbone/all.js'), 'backbone:all');
    });

    it('works with Windows\' paths', function () {
      assert.equal(env.namespace('backbone\\all\\main.js'), 'backbone:all');
      assert.equal(env.namespace('backbone\\all'), 'backbone:all');
      assert.equal(env.namespace('backbone\\all.js'), 'backbone:all');
    });

    it('remove lookups from namespace', function () {
      assert.equal(env.namespace('backbone/templates/all/index.js'), 'backbone:all');
      assert.equal(env.namespace('backbone/lib/templates/all/index.js'), 'backbone:all');
      assert.equal(env.namespace('some-lib/templates/all/index.js'), 'some-lib:all');
      assert.equal(env.namespace('my.thing/templates/app/index.js'), 'my.thing:app');
      assert.equal(env.namespace('meta/templates/templates-thing/index.js'), 'meta:templates-thing');
    });

    it('remove path before the template name', function () {
      assert.equal(env.namespace('/Users/yeoman/.nvm/v0.10.22/lib/node_modules/template-backbone/all/index.js'), 'backbone:all');
      assert.equal(env.namespace('/usr/lib/node_modules/template-backbone/all/index.js'), 'backbone:all');
    });

    it('handle paths when multiples lookups are in it', function () {
      assert.equal(
        env.namespace('c:\\projects\\yeoman\\templates\\template-example\\templates\\app\\index.js'),
        'example:app'
      );
    });

    it('handles namespaces', function () {
      assert.equal(env.namespace('backbone:app'), 'backbone:app');
      assert.equal(env.namespace('foo'), 'foo');
    });
  });

  describe('#get()', () => {
    const template = path.resolve(path.join(__dirname, './fixtures/template-mocha'));

    beforeEach(function () {
      env
        .register(template, 'mocha:template')
        .register(template, 'fixtures:template-mocha');
    });

    it('get a specific template', function () {
      assertTemplate(env.get('mocha:template'), template);
      assertTemplate(env.get('fixtures:template-mocha'), template);
    });

    it('remove paths from namespace at resolution (for backward compatibility)', function () {
      assertTemplate(env.get('mocha:template:/a/dummy/path/'), template);
      assertTemplate(env.get('mocha:template:C:\\foo\\bar'), template);
    });

    it('fallback to requiring template from a file path', function () {
      assertTemplate(
        env.get(path.join(__dirname, './fixtures/template-mocha')),
        template
      );
    });

    it('returns undefined if namespace is not found', function () {
      assert.equal(env.get('not:there'), undefined);
      assert.equal(env.get(), undefined);
    });

    it('works with modules', function () {
      env.register(path.join(__dirname, './fixtures/template-module/templates/app'), 'fixtures:template-module');
      assertTemplate(env.get('fixtures:template-module'), path.join(__dirname, './fixtures/template-module/templates/app'));
    });
  });

  describe('#alias()', () => {
    it('apply regex and replace with alternative value', function () {
      env.alias(/^([^:]+)$/, '$1:app');
      assert.equal(env.alias('foo'), 'foo:app');
    });

    it('apply multiple regex', function () {
      env.alias(/^([a-zA-Z0-9:*]+)$/, 'template-$1');
      env.alias(/^([^:]+)$/, '$1:app');
      assert.equal(env.alias('foo'), 'template-foo:app');
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
      assert.equal(env.alias('prefix-mocha:template'), 'mocha:template');
      assert.equal(env.alias('prefix-fixtures:template-mocha'), 'fixtures:template-mocha');
      assert.equal(env.alias('@scoped/prefix-fixtures:template-mocha'), '@scoped/fixtures:template-mocha');
    });
  });

  describe('#get() with #alias()', () => {
    let template;
    beforeEach(function () {
      template = path.join(__dirname, './fixtures/template-mocha');
      env.alias(/^prefix-(.*)$/, '$1');
      env
        .register(template, 'fixtures:template-mocha')
        .register(template, 'mocha:template');
    });

    it('get a specific template', function () {
      assertTemplate(env.get('prefix-mocha:template'), template);
      assertTemplate(env.get('mocha:template'), template);
      assertTemplate(env.get('prefix-fixtures:template-mocha'), template);
      assertTemplate(env.get('fixtures:template-mocha'), template);
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
      const name = Environment.namespaceToName('mocha:template');
      assert.equal(name, 'mocha');
    });
  });
});
