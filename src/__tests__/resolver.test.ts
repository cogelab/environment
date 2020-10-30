import fs = require('fs-extra');
import path = require('path');
import assert = require('assert');
import {Environment} from '../environment';
import {execaOutput} from '../util';
import {
  assertGenerator,
  exec,
  fslinkDir,
  fsunlink,
  npmLinkFixtures,
  npmUnlinkFixtures,
} from './support';
import {LookupOptions} from '../resolver';

const globalLookupTest = process.env.NODE_PATH ? it : xit;

describe('Environment Resolver', function () {
  let cwd: string;

  beforeAll(function () {
    cwd = process.cwd();
    process.chdir(__dirname);
  });

  afterAll(function () {
    process.chdir(cwd);
  });

  describe('#lookup()', () => {
    const deps = ['gen-dummytest'];
    let scopedFolder: fs.PathLike;
    let scopedGenerator: string | string[];
    let lookupOptions: boolean | Partial<LookupOptions> | undefined;
    const links: string[] = [];
    let projectRoot: string;
    let env: Environment;

    beforeAll(function () {
      projectRoot = path.join(__dirname, 'fixtures/lookup-project');
      process.chdir(projectRoot);
      scopedFolder = path.resolve('node_modules/@dummyscope');
      scopedGenerator = path.join(scopedFolder, 'gen-scoped');
      exec('npm i --no-package-lock');
      exec('npm i -g gen-dummy --no-package-lock');
      npmLinkFixtures(deps);

      links.push(fslinkDir('../gen-jquery', 'node_modules/gen-jquery'));
      links.push(fslinkDir('../gen-extend', 'node_modules/gen-extend'));
      links.push(fslinkDir('../gen-ts', 'node_modules/gen-ts'));
      links.push(fslinkDir('../gen-ts-js', 'node_modules/gen-ts-js'));

      if (!fs.existsSync(scopedFolder)) {
        fs.mkdirSync(scopedFolder);
      }
      links.push(fslinkDir('../gen-scoped', scopedGenerator));
    }, 500000);

    afterAll(function () {
      npmUnlinkFixtures(deps);
      fsunlink(links);
      fsunlink(scopedGenerator);
      fs.rmdirSync(scopedFolder);
      process.chdir(__dirname);
    });

    beforeEach(function () {
      env = new Environment();
      expect(env.namespaces().length).toBe(0);
      env.lookup(lookupOptions);
    });

    it('register local generators', function () {
      expect(env.get('dummy:app')).toBeTruthy();
      expect(env.get('dummy:coge')).toBeTruthy();

      expect(
        env.get('dummy:app')!.packagePath!.endsWith('node_modules/gen-dummy'),
      ).toBeTruthy();
      expect(
        env.get('dummy:app')!.packagePath!.endsWith('node_modules/gen-dummy'),
      ).toBeTruthy();
    }, 60000);

    it('registers local ts generators', function () {
      expect(env.get('ts:app')).toBeTruthy();
    });

    it('js generators takes precedence', function () {
      assertGenerator(
        env.get('ts-js:app')!,
        './fixtures/gen-ts-js/generators/app/template.toml',
      );
    });

    it('register generators in scoped packages', function () {
      expect(env.get('@dummyscope/scoped:app')).toBeTruthy();
    });

    it('register non-dependency local generator', function () {
      expect(env.get('jquery:app')).toBeTruthy();
    });

    if (!process.env.NODE_PATH) {
      console.log(
        'Skipping tests for global generators. Please setup `NODE_PATH` environment variable to run it.',
      );
    }

    it('local generators prioritized over global', function () {
      const {resolved} = env.get('dummy:app')!;
      expect(resolved.includes('lookup-project')).toBeTruthy();
    });

    globalLookupTest('register global generators', function () {
      expect(env.get('dummytest:app')).toBeTruthy();
      expect(env.get('dummytest:controller')).toBeTruthy();
    });

    it('register symlinked generators', function () {
      expect(env.get('extend:support')).toBeTruthy();
    });

    describe("when there's ancestor node_modules/ folder", () => {
      let projectSubRoot;

      beforeAll(function () {
        projectSubRoot = path.join(projectRoot, 'subdir');
        process.chdir(projectSubRoot);
        exec('npm i --no-package-lock');
      });

      beforeEach(function () {
        env = new Environment();
        expect(env.namespaces().length).toBe(0);
        env.lookup();
      });

      it('register generators in ancestor node_modules directory', function () {
        expect(env.get('jquery:app')).toBeTruthy();
      });

      it('local generators are prioritized over ancestor', function () {
        const resolved = env.get('dummy:app')!.resolved;
        expect(resolved.includes('subdir')).toBeTruthy();
      });
    });

    describe.skip('when modules repository is not called node_modules', () => {
      let lookupOptionsBackup: boolean | Partial<LookupOptions> | undefined;
      let customRepositoryPath: string;
      beforeAll(() => {
        customRepositoryPath = path.resolve('orig');
        lookupOptionsBackup = lookupOptions;
        lookupOptions = {npmPaths: [customRepositoryPath]};
        if (!fs.existsSync(customRepositoryPath)) {
          fs.moveSync(path.resolve('node_modules'), customRepositoryPath);
        }
      });
      afterAll(() => {
        lookupOptions = lookupOptionsBackup;
        if (fs.existsSync(path.resolve('orig'))) {
          fs.moveSync(customRepositoryPath, path.resolve('node_modules'));
        }
      });

      it('register local generators', function () {
        expect(env.get('dummy:app')).toBeTruthy();
        expect(env.get('dummy:coge')).toBeTruthy();

        expect(
          env.get('dummy:app')!.packagePath!.endsWith('/gen-dummy'),
        ).toBeTruthy();
        expect(
          env.get('dummy:app')!.packagePath!.endsWith('/gen-dummy'),
        ).toBeTruthy();
      });

      it('registers local ts generators', function () {
        expect(env.get('ts:app')).toBeTruthy();
      });

      it('js generators takes precedence', function () {
        assertGenerator(
          env.get('ts-js:app')!,
          './fixtures/gen-ts-js/generators/app/template.toml',
        );
      });

      it('register generators in scoped packages', function () {
        expect(env.get('@dummyscope/scoped:app')).toBeTruthy();
      });

      if (!process.env.NODE_PATH) {
        console.log(
          'Skipping tests for global generators. Please setup `NODE_PATH` environment variable to run it.',
        );
      }

      it('local generators prioritized over global', function () {
        const resolved = env.get('dummy:app')!.resolved;
        expect(resolved.includes('orig')).toBeTruthy();
      });

      it('register symlinked generators', function () {
        expect(env.get('extend:support')).toBeTruthy();
      });
    });

    describe('when localOnly argument is true', () => {
      beforeEach(function () {
        env = new Environment();
        expect(env.namespaces().length).toBe(0);
        env.lookup(true);
      });

      it('register local generators', function () {
        expect(env.get('dummy:app')).toBeTruthy();
        expect(env.get('dummy:coge')).toBeTruthy();
        expect(env.isPackageRegistered('dummy')).toBeTruthy();
      });

      it('register generators in scoped packages', function () {
        expect(env.get('@dummyscope/scoped:app')).toBeTruthy();
      });

      it('register non-dependency local generator', function () {
        expect(env.get('jquery:app')).toBeTruthy();
      });

      it('register symlinked generators', function () {
        expect(env.get('extend:support')).toBeTruthy();
      });

      globalLookupTest('does not register global generators', function () {
        expect(!env.get('dummytest:app')).toBeTruthy();
        expect(!env.get('dummytest:controller')).toBeTruthy();
      });
    });

    describe('when options.localOnly argument is true', () => {
      beforeEach(function () {
        env = new Environment();
        expect(env.namespaces().length).toBe(0);
        env.lookup({localOnly: true});
      });

      it('register local generators', function () {
        expect(env.get('dummy:app')).toBeTruthy();
        expect(env.get('dummy:coge')).toBeTruthy();
      });

      it('register generators in scoped packages', function () {
        expect(env.get('@dummyscope/scoped:app')).toBeTruthy();
      });

      it('register non-dependency local generator', function () {
        expect(env.get('jquery:app')).toBeTruthy();
      });

      it('register symlinked generators', function () {
        expect(env.get('extend:support')).toBeTruthy();
      });

      globalLookupTest('does not register global generators', function () {
        expect(!env.get('dummytest:app')).toBeTruthy();
        expect(!env.get('dummytest:controller')).toBeTruthy();
      });
    });
  });

  describe('#lookup() with options', () => {
    let projectRoot;
    let env: Environment;
    let npmPath: string;

    let generatorScope: string;

    const links: string[] = [];

    beforeAll(function () {
      projectRoot = path.join(__dirname, 'fixtures/lookup-custom');
      process.chdir(projectRoot);

      npmPath = path.join(projectRoot, 'node_modules');
      if (!fs.existsSync(npmPath)) {
        fs.mkdirSync(npmPath);
      }

      generatorScope = path.join(npmPath, '@scoped');
      if (!fs.existsSync(generatorScope)) {
        fs.mkdirSync(generatorScope);
      }

      links.push(
        fslinkDir('../gen-scoped', path.join(generatorScope, 'gen-scoped')),
      );
      links.push(
        fslinkDir(
          '../gen-module-lib-gen',
          path.join(npmPath, 'gen-module-lib-gen'),
        ),
      );
      links.push(fslinkDir('../gen-module', path.join(npmPath, 'gen-module')));
      links.push(
        fslinkDir('../gen-module-root', path.join(npmPath, 'gen-module-root')),
      );
    });

    beforeEach(function () {
      env = new Environment();
    });

    afterAll(function () {
      fsunlink(links);

      fs.rmdirSync(generatorScope);
      fs.rmdirSync(npmPath);

      process.chdir(__dirname);
    });

    it('with packagePaths', function () {
      env.lookup({
        packagePaths: ['node_modules/gen-module'],
      });
      expect(env.get('module:app')).toBeTruthy();
      expect(env.getRegisteredPackages().length === 1).toBeTruthy();
    });

    it('with 2 packagePaths', function () {
      env.lookup({
        packagePaths: [
          'node_modules/gen-module',
          'node_modules/gen-module-root',
        ],
      });
      expect(env.get('module:app')).toBeTruthy();
      expect(env.get('module-root:app')).toBeTruthy();
      expect(env.getRegisteredPackages().length === 2).toBeTruthy();
    });

    it('with 3 packagePaths', function () {
      env.lookup({
        packagePaths: [
          'node_modules/gen-module',
          'node_modules/gen-module-root',
          'node_modules/gen-module-lib-gen',
        ],
      });
      expect(env.get('module:app')).toBeTruthy();
      expect(env.get('module-root:app')).toBeTruthy();
      expect(env.get('module-lib-gen:app')).toBeTruthy();
      expect(env.getRegisteredPackages().length === 3).toBeTruthy();
    });

    it('with scoped packagePaths', function () {
      env.lookup({
        packagePaths: [
          'node_modules/gen-module',
          'node_modules/gen-module-root',
          'node_modules/gen-module-lib-gen',
          'node_modules/@scoped/gen-scoped',
        ],
      });
      expect(env.get('module:app')).toBeTruthy();
      expect(env.get('module-root:app')).toBeTruthy();
      expect(env.get('module-lib-gen:app')).toBeTruthy();
      expect(env.get('@scoped/scoped:app')).toBeTruthy();
      expect(env.getRegisteredPackages().length === 4).toBeTruthy();
    });

    it('with npmPaths', function () {
      env.lookup({npmPaths: ['node_modules']});
      expect(env.get('module:app')).toBeTruthy();
      expect(env.get('module-root:app')).toBeTruthy();
      expect(env.get('module-lib-gen:app')).toBeTruthy();
      expect(env.get('@scoped/scoped:app')).toBeTruthy();
      expect(env.getRegisteredPackages().length === 4).toBeTruthy();
    });

    it('with sub-sub-generators filePatterns', function () {
      env.lookup({
        npmPaths: ['node_modules'],
        filePatterns: ['*/*/template.toml'],
        globbyDeep: 3,
      });
      expect(env.get('@scoped/scoped:app:scaffold')).toBeTruthy();
    });

    it('with packagePatterns', function () {
      env.lookup({
        npmPaths: ['node_modules'],
        packagePatterns: ['gen-module', 'gen-module-root'],
      });
      expect(env.get('module:app')).toBeTruthy();
      expect(env.get('module-root:app')).toBeTruthy();
      expect(env.getRegisteredPackages().length === 2).toBeTruthy();
    });
  });

  describe('#getNpmPaths()', () => {
    let env: Environment;
    let NODE_PATH: string | undefined;
    let bestBet: string;
    let bestBet2: string;

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
        expect(paths[0]).toBe(path.join(process.cwd(), 'node_modules'));
        expect(paths[1]).toBe(path.join(process.cwd(), '../node_modules'));
      });

      it('append NODE_PATH', function () {
        assert(env.getNpmPaths().includes(process.env.NODE_PATH!));
      });
    });

    describe('without NODE_PATH', () => {
      let paths: string[];

      beforeEach(() => {
        delete process.env.NODE_PATH;
        paths = env.getNpmPaths();
      });

      it('walk up the CWD lookups dir', function () {
        // const paths = env.getNpmPaths();
        expect(paths[0]).toBe(path.join(process.cwd(), 'node_modules'));
        const prevdir = process
          .cwd()
          .split(path.sep)
          .slice(0, -1)
          .join(path.sep);
        expect(paths[1]).toBe(path.join(prevdir, 'node_modules'));
      });

      it('append best bet if NODE_PATH is unset', function () {
        assert(paths.includes(bestBet));
        assert(paths.includes(bestBet2));
      });

      it('append default NPM dir depending on your OS', function () {
        if (process.platform === 'win32') {
          assert(
            paths.includes(path.join(process.env.APPDATA!, 'npm/node_modules')),
          );
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
        expect(paths[0]).toBe(path.join(process.cwd(), 'node_modules'));
        expect(paths[1]).toBe(path.join(process.cwd(), '../node_modules'));
      });

      it('append NVM_PATH', function () {
        assert(
          env
            .getNpmPaths()
            .includes(
              path.join(path.dirname(process.env.NVM_PATH!), 'node_modules'),
            ),
        );
      });
    });

    describe('without NVM_PATH', () => {
      beforeEach(() => {
        delete process.env.NVM_PATH;
      });

      it('walk up the CWD lookups dir', function () {
        const paths = env.getNpmPaths();
        expect(paths[0]).toBe(path.join(process.cwd(), 'node_modules'));
        expect(paths[1]).toBe(path.join(process.cwd(), '../node_modules'));
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
        expect(paths[0]).toBe(path.join(process.cwd(), 'node_modules'));
        expect(paths[1]).toBe(path.join(process.cwd(), '../node_modules'));
      });

      it('does not append NODE_PATH', function () {
        process.env.NODE_PATH = '/some/dummy/path';
        assert(!env.getNpmPaths(true).includes(process.env.NODE_PATH));
      });

      it('does not append NVM_PATH', function () {
        process.env.NVM_PATH = '/some/dummy/path';
        assert(
          !env
            .getNpmPaths(true)
            .includes(
              path.join(path.dirname(process.env.NVM_PATH), 'node_modules'),
            ),
        );
      });

      it('does not append best bet', function () {
        assert(!env.getNpmPaths(true).includes(bestBet));
      });

      it('does not append default NPM dir depending on your OS', function () {
        if (process.platform === 'win32') {
          assert(
            !env
              .getNpmPaths(true)
              .includes(path.join(process.env.APPDATA!, 'npm/node_modules')),
          );
        } else {
          assert(!env.getNpmPaths(true).includes('/usr/lib/node_modules'));
        }
      });
    });

    describe('with npm global prefix', () => {
      it('append npm modules path depending on your OS', function () {
        const npmPrefix = execaOutput('npm', ['prefix', '-g']);
        if (process.platform === 'win32') {
          assert(
            env.getNpmPaths().indexOf(path.resolve(npmPrefix, 'node_modules')) >
              0,
          );
        } else {
          assert(
            env
              .getNpmPaths()
              .indexOf(path.resolve(npmPrefix, 'lib/node_modules')) > 0,
          );
        }
      });
    });
  });

  describe('#findGeneratorsIn()', () => {
    let env: Environment;

    beforeEach(function () {
      env = new Environment();
    });

    describe('when root path is not a valid generator', () => {
      it('pass through root directory', function () {
        const dummyGenerator = 'fixtures/lookup-project/node_modules';
        const generators = env.findGeneratorsIn([dummyGenerator]);
        expect(generators.length >= 5).toBeTruthy();
      });
    });
  });

  describe('#lookupGenerator()', () => {
    const scopedFolder = path.resolve('node_modules/@dummyscope');
    const scopedGenerator = path.join(scopedFolder, 'gen-scoped');
    const moduleGenerator = path.resolve('node_modules/gen-module');

    let projectRoot;
    const links: string[] = [];

    beforeAll(function () {
      projectRoot = path.join(__dirname, 'fixtures/lookup-project');
      process.chdir(projectRoot);

      if (!fs.existsSync(scopedFolder)) {
        fs.mkdirSync(scopedFolder);
      }

      links.push(fslinkDir(path.resolve('../gen-scoped'), scopedGenerator));
      links.push(fslinkDir(path.resolve('../gen-module'), moduleGenerator));
    });

    afterAll(() => {
      fsunlink(links);
      fs.rmdirSync(scopedFolder);
      process.chdir(__dirname);
    });

    describe('Find generator', () => {
      it('Scoped lookup', () => {
        const modulePath = <string>(
          Environment.lookupGenerator('@dummyscope/scoped:app')
        );
        expect(
          modulePath.endsWith(
            'node_modules/@dummyscope/gen-scoped/app/template.toml',
          ),
        ).toBeTruthy();
        const packagePath = <string>Environment.lookupGenerator(
          '@dummyscope/scoped:app',
          {
            packagePath: true,
          },
        );
        expect(
          packagePath.endsWith('node_modules/@dummyscope/gen-scoped'),
        ).toBeTruthy();
      });
      it('Lookup', () => {
        const modulePath = <string>Environment.lookupGenerator('dummy:app');
        const modulePath2 = <string>Environment.lookupGenerator('dummy:coge');
        expect(
          modulePath.endsWith('node_modules/gen-dummy/app/template.toml'),
        ).toBeTruthy();
        expect(
          modulePath2.endsWith('node_modules/gen-dummy/coge/template.toml'),
        ).toBeTruthy();

        const packagePath = <string>(
          Environment.lookupGenerator('dummy:app', {packagePath: true})
        );
        const packagePath2 = <string>(
          Environment.lookupGenerator('dummy:coge', {packagePath: true})
        );
        const packagePath3 = <string>(
          Environment.lookupGenerator('dummy', {packagePath: true})
        );
        expect(packagePath.endsWith('node_modules/gen-dummy')).toBeTruthy();
        expect(packagePath2.endsWith('node_modules/gen-dummy')).toBeTruthy();
        expect(packagePath3.endsWith('node_modules/gen-dummy')).toBeTruthy();
      });
      it('Module Lookup', () => {
        const modulePath = <string>Environment.lookupGenerator('module:app');
        expect(
          modulePath.endsWith(
            'node_modules/gen-module/generators/app/template.toml',
          ),
        ).toBeTruthy();

        const packagePath = <string>(
          Environment.lookupGenerator('module:app', {packagePath: true})
        );
        expect(packagePath.endsWith('node_modules/gen-module')).toBeTruthy();

        const generatorPath = <string>(
          Environment.lookupGenerator('module:app', {generatorPath: true})
        );
        expect(
          generatorPath.endsWith('node_modules/gen-module/generators/'),
        ).toBeTruthy();
      });
    });
  });

  describe('#lookupGenerator() with multiple option', () => {
    const projectRoot = path.join(__dirname, 'fixtures/lookup-project/');
    const moduleGenerator = path.join(projectRoot, 'node_modules/gen-module');
    const chdirRoot = path.join(
      __dirname,
      'fixtures/lookup-project/node_modules/foo',
    );
    const chdirRootNodeModule = path.join(chdirRoot, 'node_modules');
    const multipleModuleGenerator = path.join(
      chdirRoot,
      'node_modules/gen-module',
    );

    const links: string[] = [];

    beforeAll(() => {
      if (!fs.existsSync(chdirRoot)) {
        fs.mkdirSync(chdirRoot);
      }
      links.push(
        fslinkDir(path.resolve('fixtures/gen-module'), moduleGenerator),
      );

      if (!fs.existsSync(chdirRootNodeModule)) {
        fs.mkdirSync(chdirRootNodeModule);
      }
      links.push(
        fslinkDir(path.resolve('fixtures/gen-module'), multipleModuleGenerator),
      );

      process.chdir(chdirRoot);
    });

    afterAll(() => {
      process.chdir(__dirname);

      fsunlink(links);
      fs.rmdirSync(chdirRootNodeModule);
      fs.rmdirSync(chdirRoot);
    });

    describe('Find generator', () => {
      it('Module Lookup', () => {
        const modulePath = <string>Environment.lookupGenerator('module:app');
        expect(
          modulePath.endsWith(
            'node_modules/gen-module/generators/app/template.toml',
          ),
        ).toBeTruthy();

        const multiplePath = Environment.lookupGenerator('module:app', {
          multiple: true,
        });
        expect(
          multiplePath[0].endsWith(
            'lookup-project/node_modules/gen-module/generators/app/template.toml',
          ),
        ).toBeTruthy();
        expect(
          multiplePath[1].endsWith(
            'lookup-project/node_modules/foo/node_modules/gen-module/generators/app/template.toml',
          ),
        ).toBeTruthy();

        const multiplePath2 = Environment.lookupGenerator('module:app', {
          singleResult: false,
        });
        expect(
          multiplePath2[0].endsWith(
            'lookup-project/node_modules/gen-module/generators/app/template.toml',
          ),
        ).toBeTruthy();
        expect(
          multiplePath2[1].endsWith(
            'lookup-project/node_modules/foo/node_modules/gen-module/generators/app/template.toml',
          ),
        ).toBeTruthy();
      });
    });
  });

  describe('Environment with a generator extended by environment lookup', () => {
    let projectRoot: string;

    beforeAll(function () {
      projectRoot = path.join(__dirname, 'fixtures/lookup-project');
      process.chdir(projectRoot);

      if (!fs.existsSync(path.resolve('node_modules/gen-environment-extend'))) {
        fs.symlinkSync(
          path.resolve('../gen-environment-extend'),
          path.resolve('node_modules/gen-environment-extend'),
          'dir',
        );
      }
    });

    afterAll(function () {
      fs.unlinkSync(
        path.join(projectRoot, 'node_modules/gen-environment-extend'),
      );
      process.chdir(__dirname);
    });

    describe('Find generator', () => {
      let env;

      it('Generator extended by environment lookup', () => {
        env = new Environment();
        expect(env.namespaces().length).toBe(0);
        env.lookup();
        expect(env.get('environment-extend:app')).toBeTruthy();
      });
    });
  });
});
