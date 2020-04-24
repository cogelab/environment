import * as path from "path";
import * as fs from "fs-extra";
import spawn = require('cross-spawn');
import * as assert from "assert";
import toArray from "@tiopkg/utils/array/toArray";
import * as execa from "execa";

export function assertTemplate(real, resolved: string) {
  assert.ok(real);
  assert.equal(real.resolved, path.resolve(__dirname, resolved));
}

export function exec(cmd) {
  execa.sync(cmd, {shell: true});
}

export function npmLinkFixtures(pkgs: string | string[]) {
  const cwd = process.cwd();
  try {
    for (const pkg of toArray(pkgs)) {
      process.chdir(path.resolve(__dirname, 'fixtures', pkg));
      exec('npm link');
    }
  } finally {
    process.chdir(cwd)
  }
}

export function npmUnlinkFixtures(pkgs: string | string[]) {
  const cwd = process.cwd();
  try {
    for (const pkg of toArray(pkgs)) {
      process.chdir(path.resolve(__dirname, 'fixtures', pkg));
      exec('npm unlink');
    }
  } finally {
    process.chdir(cwd)
  }
}

export function fslinkDir(source: string, target: string) {
  if (!fs.existsSync(path.resolve(target))) {
    fs.symlinkSync(
      path.resolve(source),
      path.resolve(target),
      'dir'
    );
    return target;
  }
  return '';
}

export function fsunlink(target: string | string[]) {
  for (const t of toArray(target)) {
    t && fs.unlinkSync(path.resolve(t));
  }
}
