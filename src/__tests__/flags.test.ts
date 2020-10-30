import assert = require('assert');
import os = require('os');
import path = require('path');
import fs = require('fs-extra');
import {Environment} from '../environment';

const tmpdir = path.join(os.tmpdir(), 'coge-environment/auto-install');

describe.skip('Namespace flags', () => {
  let env: Environment;
  let cwd: string;

  beforeAll(function () {
    fs.mkdirpSync(tmpdir);
    cwd = process.cwd();
    process.chdir(tmpdir);
  });

  afterAll(function () {
    process.chdir(cwd);
    fs.removeSync(tmpdir);
  });

  beforeEach(function () {
    env = new Environment();
  });

  it('auto-install a module', function () {
    try {
      env.get('dummy!?');
      assert.fail();
    } catch (e) {
      // no-op
    }
    expect(env.get('dummy!')).toBeTruthy();
    expect(env.get('dummy:app')).toBeTruthy();
  }, 60000);

  it('auto-load a module', function () {
    expect(env.get('dummy:coge!?')).toBeTruthy();
  }, 10000);
});
