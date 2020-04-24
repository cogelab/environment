import fs = require('fs-extra');
import path = require('path');
import assert = require('assert');
import {Environment} from '../environment';
import {execaOutput} from '../util';
import {
  assertTemplate,
  exec,
  fslinkDir,
  fsunlink,
  npmLinkFixtures,
  npmUnlinkFixtures,
} from "./support";

const globalLookupTest = process.env.NODE_PATH ? it : xit;

describe('Environment Resolver', function () {

  let cwd;

  beforeAll(function () {
    cwd = process.cwd();
    process.chdir(__dirname);
  });

  afterAll(function () {
    process.chdir(cwd);
  });

  describe('#lookup()', () => {
    const deps = [
      'template-dummytest',
    ]
    let scopedFolder;
    let scopedTemplate;
    let lookupOptions;
    const links: string[] = [];
    let projectRoot;
    let env;

    beforeAll(function () {
      projectRoot = path.join(__dirname, 'fixtures/lookup-project');
      process.chdir(projectRoot);
      scopedFolder = path.resolve('node_modules/@dummyscope');
      scopedTemplate = path.join(scopedFolder, 'template-scoped');
      exec('npm i --no-package-lock');
      exec('npm i -g template-dummy --no-package-lock')
      npmLinkFixtures(deps);

      links.push(fslinkDir('../template-jquery', 'node_modules/template-jquery'));
      links.push(fslinkDir('../template-extend', 'node_modules/template-extend'));
      links.push(fslinkDir('../template-ts', 'node_modules/template-ts'));
      links.push(fslinkDir('../template-ts-js', 'node_modules/template-ts-js'));

      if (!fs.existsSync(scopedFolder)) {
        fs.mkdirSync(scopedFolder);
      }
      links.push(fslinkDir('../template-scoped', scopedTemplate));
    }, 500000);

    afterAll(function () {
      npmUnlinkFixtures(deps);
      fsunlink(links);
      fsunlink(scopedTemplate);
      fs.rmdirSync(scopedFolder);
      process.chdir(__dirname);
    });

    beforeEach(function () {
      env = new Environment();
      assert.equal(env.namespaces().length, 0, 'ensure env is empty');
      env.lookup(lookupOptions);
    });

    it('register local templates', function () {
      assert.ok(env.get('dummy:app'));
      assert.ok(env.get('dummy:coge'));

      assert.ok(env.get('dummy:app').packagePath.endsWith('node_modules/template-dummy'));
      assert.ok(env.get('dummy:app').packagePath.endsWith('node_modules/template-dummy'));
    }, 60000);

    it('registers local ts templates', function () {
      assert.ok(env.get('ts:app'));
    });

    it('js templates takes precedence', function () {
      assertTemplate(env.get('ts-js:app'), './fixtures/template-ts-js/templates/app/coge.yml');
    });

    it('register templates in scoped packages', function () {
      assert.ok(env.get('@dummyscope/scoped:app'));
    });

    it('register non-dependency local template', function () {
      assert.ok(env.get('jquery:app'));
    });

    if (!process.env.NODE_PATH) {
      console.log('Skipping tests for global templates. Please setup `NODE_PATH` environment variable to run it.');
    }

    it('local templates prioritized over global', function () {
      const {resolved} = env.get('dummy:app');
      assert.ok(resolved.includes('lookup-project'), `Couldn't find 'lookup-project' in ${resolved}`);
    });

    globalLookupTest('register global templates', function () {
      assert.ok(env.get('dummytest:app'));
      assert.ok(env.get('dummytest:controller'));
    });

    it('register symlinked templates', function () {
      assert.ok(env.get('extend:support'));
    });

    describe('when there\'s ancestor node_modules/ folder', () => {
      let projectSubRoot;

      beforeAll(function () {
        projectSubRoot = path.join(projectRoot, 'subdir');
        process.chdir(projectSubRoot);
        exec('npm i --no-package-lock');
      });

      beforeEach(function () {
        env = new Environment();
        assert.equal(env.namespaces().length, 0, 'ensure env is empty');
        env.lookup();
      });

      it('register templates in ancestor node_modules directory', function () {
        assert.ok(env.get('jquery:app'));
      });

      it('local templates are prioritized over ancestor', function () {
        const resolved = env.get('dummy:app').resolved;
        assert.ok(resolved.includes('subdir'), `Couldn't find 'subdir' in ${resolved}`);
      });
    });

    describe.skip('when modules repository is not called node_modules', () => {
      let lookupOptionsBackup;
      let customRepositoryPath;
      beforeAll(() => {
        customRepositoryPath = path.resolve('orig');
        lookupOptionsBackup = lookupOptions;
        lookupOptions = {npmPaths: [customRepositoryPath]};
        if (!fs.existsSync(customRepositoryPath)) {
          fs.moveSync(
            path.resolve('node_modules'),
            customRepositoryPath
          );
        }
      });
      afterAll(() => {
        lookupOptions = lookupOptionsBackup;
        if (fs.existsSync(path.resolve('orig'))) {
          fs.moveSync(
            customRepositoryPath,
            path.resolve('node_modules')
          );
        }
      });

      it('register local templates', function () {
        assert.ok(this.env.get('dummy:app'));
        assert.ok(this.env.get('dummy:coge'));

        assert.ok(this.env.get('dummy:app').packagePath.endsWith('/template-dummy'));
        assert.ok(this.env.get('dummy:app').packagePath.endsWith('/template-dummy'));
      });

      it('registers local ts templates', function () {
        assert.ok(this.env.get('ts:app'));
      });

      it('js templates takes precedence', function () {
        // eslint-disable-next-line unicorn/import-index
        assert.equal(this.env.get('ts-js:app'), require('./fixtures/template-ts-js/templates/app/coge.yml'));
      });

      it('register templates in scoped packages', function () {
        assert.ok(this.env.get('@dummyscope/scoped:app'));
      });

      if (!process.env.NODE_PATH) {
        console.log('Skipping tests for global templates. Please setup `NODE_PATH` environment variable to run it.');
      }

      it('local templates prioritized over global', function () {
        const resolved = this.env.get('dummy:app').resolved;
        assert.ok(resolved.includes('orig'), `Couldn't find 'lookup-project' in ${resolved}`);
      });

      it('register symlinked templates', function () {
        assert.ok(this.env.get('extend:support'));
      });
    });

    describe('when localOnly argument is true', () => {
      beforeEach(function () {
        env = new Environment();
        assert.equal(env.namespaces().length, 0, 'ensure env is empty');
        env.lookup(true);
      });

      it('register local templates', function () {
        assert.ok(env.get('dummy:app'));
        assert.ok(env.get('dummy:coge'));
        assert.ok(env.isPackageRegistered('dummy'));
      });

      it('register templates in scoped packages', function () {
        assert.ok(env.get('@dummyscope/scoped:app'));
      });

      it.skip('register non-dependency local template', function () {
        assert.ok(env.get('jquery:app'));
      });

      it('register symlinked templates', function () {
        assert.ok(env.get('extend:support'));
      });

      globalLookupTest('does not register global templates', function () {
        assert.ok(!env.get('dummytest:app'));
        assert.ok(!env.get('dummytest:controller'));
      });
    });

    describe('when options.localOnly argument is true', () => {
      beforeEach(function () {
        env = new Environment();
        assert.equal(env.namespaces().length, 0, 'ensure env is empty');
        env.lookup({localOnly: true});
      });

      it('register local templates', function () {
        assert.ok(env.get('dummy:app'));
        assert.ok(env.get('dummy:coge'));
      });

      it('register templates in scoped packages', function () {
        assert.ok(env.get('@dummyscope/scoped:app'));
      });

      it('register non-dependency local template', function () {
        assert.ok(env.get('jquery:app'));
      });

      it('register symlinked templates', function () {
        assert.ok(env.get('extend:support'));
      });

      globalLookupTest('does not register global templates', function () {
        assert.ok(!env.get('dummytest:app'));
        assert.ok(!env.get('dummytest:controller'));
      });
    });
  });

  describe('#lookup() with options', () => {
    let projectRoot;
    let env;
    let npmPath;

    let templateScope;

    const links: string[] = [];

    beforeAll(function () {
      projectRoot = path.join(__dirname, 'fixtures/lookup-custom');
      process.chdir(projectRoot);

      npmPath = path.join(projectRoot, 'node_modules');
      if (!fs.existsSync(npmPath)) {
        fs.mkdirSync(npmPath);
      }

      templateScope = path.join(npmPath, '@scoped');
      if (!fs.existsSync(templateScope)) {
        fs.mkdirSync(templateScope);
      }

      links.push(fslinkDir('../template-scoped', path.join(templateScope, 'template-scoped')));
      links.push(fslinkDir('../template-module-lib-gen', path.join(npmPath, 'template-module-lib-gen')));
      links.push(fslinkDir('../template-module', path.join(npmPath, 'template-module')));
      links.push(fslinkDir('../template-module-root', path.join(npmPath, 'template-module-root')));
    });

    beforeEach(function () {
      env = new Environment();
    });

    afterAll(function () {
      fsunlink(links);

      fs.rmdirSync(templateScope);
      fs.rmdirSync(npmPath);

      process.chdir(__dirname);
    });

    it('with packagePaths', function () {
      env.lookup({
        packagePaths: [
          'node_modules/template-module'
        ]
      });
      assert.ok(env.get('module:app'));
      assert.ok(env.getRegisteredPackages().length === 1);
    });

    it('with 2 packagePaths', function () {
      env.lookup({
        packagePaths: [
          'node_modules/template-module',
          'node_modules/template-module-root'
        ]
      });
      assert.ok(env.get('module:app'));
      assert.ok(env.get('module-root:app'));
      assert.ok(env.getRegisteredPackages().length === 2);
    });

    it('with 3 packagePaths', function () {
      env.lookup({
        packagePaths: [
          'node_modules/template-module',
          'node_modules/template-module-root',
          'node_modules/template-module-lib-gen'
        ]
      });
      assert.ok(env.get('module:app'));
      assert.ok(env.get('module-root:app'));
      assert.ok(env.get('module-lib-gen:app'));
      assert.ok(env.getRegisteredPackages().length === 3);
    });

    it('with scoped packagePaths', function () {
      env.lookup({
        packagePaths: [
          'node_modules/template-module',
          'node_modules/template-module-root',
          'node_modules/template-module-lib-gen',
          'node_modules/@scoped/template-scoped'
        ]
      });
      assert.ok(env.get('module:app'));
      assert.ok(env.get('module-root:app'));
      assert.ok(env.get('module-lib-gen:app'));
      assert.ok(env.get('@scoped/scoped:app'));
      assert.ok(env.getRegisteredPackages().length === 4);
    });

    it('with npmPaths', function () {
      env.lookup({npmPaths: ['node_modules']});
      assert.ok(env.get('module:app'));
      assert.ok(env.get('module-root:app'));
      assert.ok(env.get('module-lib-gen:app'));
      assert.ok(env.get('@scoped/scoped:app'));
      assert.ok(env.getRegisteredPackages().length === 4);
    });

    it('with sub-sub-templates filePatterns', function () {
      env.lookup({npmPaths: ['node_modules'], filePatterns: ['*/*/coge.yml'], globbyDeep: 3});
      assert.ok(env.get('@scoped/scoped:app:scaffold'));
    });

    it('with packagePatterns', function () {
      env.lookup({npmPaths: ['node_modules'], packagePatterns: ['template-module', 'template-module-root']});
      assert.ok(env.get('module:app'));
      assert.ok(env.get('module-root:app'));
      assert.ok(env.getRegisteredPackages().length === 2);
    });
  });

  describe.skip('#lookupNamespaces()', () => {
    let projectRoot;
    let env;
    let npmPath;
    let templateScope;
    let templateScopedPath;
    let templateLibGenPath;
    let templatePath;
    let templateRootPath;

    beforeAll(function () {
      projectRoot = path.join(__dirname, 'fixtures/lookup-custom');
      process.chdir(projectRoot);

      npmPath = path.join(projectRoot, 'node_modules');
      if (!fs.existsSync(npmPath)) {
        fs.mkdirSync(npmPath);
      }

      templateScope = path.join(npmPath, '@scoped');
      if (!fs.existsSync(templateScope)) {
        fs.mkdirSync(templateScope);
      }

      templateScopedPath = path.join(templateScope, 'template-scoped');
      if (!fs.existsSync(templateScopedPath)) {
        fs.symlinkSync(
          path.resolve('../template-scoped'),
          templateScopedPath,
          'dir'
        );
      }

      templateLibGenPath = path.join(npmPath, 'template-module-lib-gen');
      if (!fs.existsSync(templateLibGenPath)) {
        fs.symlinkSync(
          path.resolve('../template-module-lib-gen'),
          templateLibGenPath,
          'dir'
        );
      }

      templatePath = path.join(npmPath, 'template-module');
      if (!fs.existsSync(templatePath)) {
        fs.symlinkSync(
          path.resolve('../template-module'),
          templatePath,
          'dir'
        );
      }

      templateRootPath = path.join(npmPath, 'template-module-root');
      if (!fs.existsSync(templateRootPath)) {
        fs.symlinkSync(
          path.resolve('../template-module-root'),
          templateRootPath,
          'dir'
        );
      }
    });

    beforeEach(function () {
      env = new Environment();
    });

    afterAll(function () {
      fs.unlinkSync(templatePath);
      fs.unlinkSync(templateLibGenPath);
      fs.unlinkSync(templateRootPath);

      fs.unlinkSync(templateScopedPath);
      fs.rmdirSync(templateScope);

      fs.rmdirSync(npmPath);

      process.chdir(__dirname);
    });

    it('with 1 namespace', function () {
      env.lookupNamespaces('module:app', {
        npmPaths: [
          'node_modules'
        ]
      });
      assert.ok(env.get('module:app'));
      assert.ok(env.getRegisteredPackages().length === 1);
    });

    it('with 2 namespaces', function () {
      env.lookupNamespaces(
        [
          'module:app',
          'module-root:app'
        ], {npmPaths: ['node_modules']}
      );
      assert.ok(env.get('module:app'));
      assert.ok(env.get('module-root:app'));
      assert.ok(env.getRegisteredPackages().length === 2);
    });

    it('with sub-sub-templates', function () {
      env.lookupNamespaces('@scoped/scoped:app:scaffold', {
        npmPaths: [
          'node_modules'
        ]
      });
      assert.ok(env.get('@scoped/scoped:app:scaffold'));
      assert.ok(env.getRegisteredPackages().length === 1);
    });
  });

  describe('#getNpmPaths()', () => {
    let env;
    let NODE_PATH;
    let bestBet;
    let bestBet2;

    beforeEach(function () {
      NODE_PATH = process.env.NODE_PATH;
      bestBet = path.join(__dirname, '../../..', '../..');
      bestBet2 = path.join(path.dirname(process.argv[1]), '../..');
      env = new Environment();
    });

    afterEach(function () {
      process.env.NODE_PATH = NODE_PATH;
    });

    describe('with NODE_PATH', () => {
      beforeEach(() => {
        process.env.NODE_PATH = '/some/dummy/path';
      });

      afterEach(() => {
        delete process.env.NODE_PATH;
      });

      it('walk up the CWD lookups dir', function () {
        const paths = env.getNpmPaths();
        assert.equal(paths[0], path.join(process.cwd(), 'node_modules'));
        assert.equal(paths[1], path.join(process.cwd(), '../node_modules'));
      });

      it('append NODE_PATH', function () {
        assert(env.getNpmPaths().includes(process.env.NODE_PATH));
      });
    });

    describe('without NODE_PATH', () => {
      let paths;

      beforeEach(() => {
        delete process.env.NODE_PATH;
        paths = env.getNpmPaths();
      });

      it('walk up the CWD lookups dir', function () {
        // const paths = env.getNpmPaths();
        assert.equal(paths[0], path.join(process.cwd(), 'node_modules'));
        const prevdir = process.cwd().split(path.sep).slice(0, -1).join(path.sep);
        assert.equal(paths[1], path.join(prevdir, 'node_modules'));
      });

      it('append best bet if NODE_PATH is unset', function () {
        assert(paths.includes(bestBet));
        assert(paths.includes(bestBet2));
      });

      it('append default NPM dir depending on your OS', function () {
        if (process.platform === 'win32') {
          assert(paths.includes(path.join(process.env.APPDATA!, 'npm/node_modules')));
        } else {
          assert(paths.includes('/usr/lib/node_modules'));
        }
      });
    });

    describe('with NVM_PATH', () => {
      beforeEach(() => {
        process.env.NVM_PATH = '/some/dummy/path';
      });

      afterEach(() => {
        delete process.env.NVM_PATH;
      });

      it('walk up the CWD lookups dir', function () {
        const paths = env.getNpmPaths();
        assert.equal(paths[0], path.join(process.cwd(), 'node_modules'));
        assert.equal(paths[1], path.join(process.cwd(), '../node_modules'));
      });

      it('append NVM_PATH', function () {
        assert(env.getNpmPaths().includes(path.join(path.dirname(process.env.NVM_PATH!), 'node_modules')));
      });
    });

    describe('without NVM_PATH', () => {
      beforeEach(() => {
        delete process.env.NVM_PATH;
      });

      it('walk up the CWD lookups dir', function () {
        const paths = env.getNpmPaths();
        assert.equal(paths[0], path.join(process.cwd(), 'node_modules'));
        assert.equal(paths[1], path.join(process.cwd(), '../node_modules'));
      });

      it('append best bet if NVM_PATH is unset', function () {
        assert(env.getNpmPaths().includes(path.join(bestBet, 'node_modules')));
        assert(env.getNpmPaths().includes(bestBet2));
      });
    });

    describe('when localOnly argument is true', () => {
      afterEach(() => {
        delete process.env.NODE_PATH;
        delete process.env.NVM_PATH;
      });

      it('walk up the CWD lookups dir', function () {
        const paths = env.getNpmPaths();
        assert.equal(paths[0], path.join(process.cwd(), 'node_modules'));
        assert.equal(paths[1], path.join(process.cwd(), '../node_modules'));
      });

      it('does not append NODE_PATH', function () {
        process.env.NODE_PATH = '/some/dummy/path';
        assert(!env.getNpmPaths(true).includes(process.env.NODE_PATH));
      });

      it('does not append NVM_PATH', function () {
        process.env.NVM_PATH = '/some/dummy/path';
        assert(!env.getNpmPaths(true).includes(path.join(path.dirname(process.env.NVM_PATH), 'node_modules')));
      });

      it('does not append best bet', function () {
        assert(!env.getNpmPaths(true).includes(bestBet));
      });

      it('does not append default NPM dir depending on your OS', function () {
        if (process.platform === 'win32') {
          assert(!env.getNpmPaths(true).includes(path.join(process.env.APPDATA!, 'npm/node_modules')));
        } else {
          assert(!env.getNpmPaths(true).includes('/usr/lib/node_modules'));
        }
      });
    });

    describe('with npm global prefix', () => {
      it('append npm modules path depending on your OS', function () {
        const npmPrefix = execaOutput('npm', ['prefix', '-g']);
        if (process.platform === 'win32') {
          assert(env.getNpmPaths().indexOf(path.resolve(npmPrefix, 'node_modules')) > 0);
        } else {
          assert(env.getNpmPaths().indexOf(path.resolve(npmPrefix, 'lib/node_modules')) > 0);
        }
      });
    });
  });

  describe('#findTemplatesIn()', () => {
    let env;

    beforeEach(function () {
      env = new Environment();
    });

    describe('when root path is not a valid template', () => {
      it('pass through root directory', function () {
        const dummyTemplate = 'fixtures/lookup-project/node_modules';
        const templates = env.findTemplatesIn([dummyTemplate]);
        assert.ok(templates.length);
      });
    });
  });

  describe('#lookupTemplate()', () => {
    const scopedFolder = path.resolve('node_modules/@dummyscope');
    const scopedTemplate = path.join(scopedFolder, 'template-scoped');
    const moduleTemplate = path.resolve('node_modules/template-module');

    let projectRoot;
    const links: string[] = [];

    beforeAll(function () {
      projectRoot = path.join(__dirname, 'fixtures/lookup-project');
      process.chdir(projectRoot);

      if (!fs.existsSync(scopedFolder)) {
        fs.mkdirSync(scopedFolder);
      }

      links.push(fslinkDir(path.resolve('../template-scoped'), scopedTemplate));
      links.push(fslinkDir(path.resolve('../template-module'), moduleTemplate));
    });

    afterAll(() => {
      fsunlink(links);
      fs.rmdirSync(scopedFolder);
      process.chdir(__dirname);
    });

    describe('Find template', () => {
      it('Scoped lookup', () => {
        const modulePath = <string>Environment.lookupTemplate('@dummyscope/scoped:app');
        assert.ok(modulePath.endsWith('node_modules/@dummyscope/template-scoped/app/coge.yml'));
        const packagePath = <string>Environment.lookupTemplate('@dummyscope/scoped:app', {packagePath: true});
        assert.ok(packagePath.endsWith('node_modules/@dummyscope/template-scoped'));
      });
      it('Lookup', () => {
        const modulePath = <string>Environment.lookupTemplate('dummy:app');
        const modulePath2 = <string>Environment.lookupTemplate('dummy:coge');
        assert.ok(modulePath.endsWith('node_modules/template-dummy/app/coge.yml'));
        assert.ok(modulePath2.endsWith('node_modules/template-dummy/coge/coge.yml'));

        const packagePath = <string>Environment.lookupTemplate('dummy:app', {packagePath: true});
        const packagePath2 = <string>Environment.lookupTemplate('dummy:coge', {packagePath: true});
        const packagePath3 = <string>Environment.lookupTemplate('dummy', {packagePath: true});
        assert.ok(packagePath.endsWith('node_modules/template-dummy'));
        assert.ok(packagePath2.endsWith('node_modules/template-dummy'));
        assert.ok(packagePath3.endsWith('node_modules/template-dummy'));
      });
      it('Module Lookup', () => {
        const modulePath = <string>Environment.lookupTemplate('module:app');
        assert.ok(modulePath.endsWith('node_modules/template-module/templates/app/coge.yml'), modulePath);

        const packagePath = <string>Environment.lookupTemplate('module:app', {packagePath: true});
        assert.ok(packagePath.endsWith('node_modules/template-module'), packagePath);

        const templatePath = <string>Environment.lookupTemplate('module:app', {templatePath: true});
        assert.ok(templatePath.endsWith('node_modules/template-module/templates/'), templatePath);
      });
    });
  });

  describe('#lookupTemplate() with multiple option', () => {
    const projectRoot = path.join(__dirname, 'fixtures/lookup-project/');
    const moduleTemplate = path.join(projectRoot, 'node_modules/template-module');
    const chdirRoot = path.join(__dirname, 'fixtures/lookup-project/node_modules/foo');
    const chdirRootNodeModule = path.join(chdirRoot, 'node_modules');
    const multipleModuleTemplate = path.join(chdirRoot, 'node_modules/template-module');

    const links: string[] = []

    beforeAll(() => {
      if (!fs.existsSync(chdirRoot)) {
        fs.mkdirSync(chdirRoot);
      }
      links.push(fslinkDir(path.resolve('fixtures/template-module'), moduleTemplate));

      if (!fs.existsSync(chdirRootNodeModule)) {
        fs.mkdirSync(chdirRootNodeModule);
      }
      links.push(fslinkDir(path.resolve('fixtures/template-module'), multipleModuleTemplate));

      process.chdir(chdirRoot);
    });

    afterAll(() => {
      process.chdir(__dirname);

      fsunlink(links);
      fs.rmdirSync(chdirRootNodeModule);
      fs.rmdirSync(chdirRoot);
    });

    describe('Find template', () => {
      it('Module Lookup', () => {
        const modulePath = <string>Environment.lookupTemplate('module:app');
        assert.ok(modulePath.endsWith('node_modules/template-module/templates/app/coge.yml'));

        const multiplePath = Environment.lookupTemplate('module:app', {multiple: true});
        assert.ok(multiplePath[0].endsWith('lookup-project/node_modules/template-module/templates/app/coge.yml'));
        assert.ok(multiplePath[1].endsWith('lookup-project/node_modules/foo/node_modules/template-module/templates/app/coge.yml'));

        const multiplePath2 = Environment.lookupTemplate('module:app', {singleResult: false});
        assert.ok(multiplePath2[0].endsWith('lookup-project/node_modules/template-module/templates/app/coge.yml'));
        assert.ok(multiplePath2[1].endsWith('lookup-project/node_modules/foo/node_modules/template-module/templates/app/coge.yml'));
      });
    });
  });

  describe('Environment with a template extended by environment lookup', () => {
    let projectRoot;

    beforeAll(function () {
      projectRoot = path.join(__dirname, 'fixtures/lookup-project');
      process.chdir(projectRoot);

      if (!fs.existsSync(path.resolve('node_modules/template-environment-extend'))) {
        fs.symlinkSync(
          path.resolve('../template-environment-extend'),
          path.resolve('node_modules/template-environment-extend'),
          'dir'
        );
      }
    });

    afterAll(function () {
      fs.unlinkSync(path.join(projectRoot, 'node_modules/template-environment-extend'));
      process.chdir(__dirname);
    });

    describe('Find template', () => {
      let env;

      it('Template extended by environment lookup', () => {
        env = new Environment();
        assert.equal(env.namespaces().length, 0, 'ensure env is empty');
        env.lookup();
        assert.ok(env.get('environment-extend:app'));
      });
    });
  });
});
