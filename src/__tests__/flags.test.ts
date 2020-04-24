import assert = require('assert');
import os = require('os');
import path = require('path');
import fs = require('fs-extra');
import {Environment} from "../environment";

const tmpdir = path.join(os.tmpdir(), 'coge-environment/auto-install');

describe.skip('Namespace flags', () => {
  let env: Environment;

  beforeAll(function () {
    fs.mkdirpSync(tmpdir);
    this.cwd = process.cwd();
    process.chdir(tmpdir);
  });

  afterAll(function () {
    process.chdir(this.cwd);
    fs.removeSync(tmpdir);
  });

  beforeEach(function () {
    env = new Environment();
  });

  it('auto-install a module', function () {
    try {
      env.get('dummy!?');
      assert.fail();
    } catch (_) {
    }
    assert.ok(env.get('dummy!'));
    assert.ok(env.get('dummy:app'));
  }, 60000);

  it('auto-load a module', function () {
    assert.ok(env.get('dummy:coge!?'));
  }, 10000);
});
