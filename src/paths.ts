import * as path from "path";
import * as fs from "fs-extra";
import untildify = require("untildify");
import toArray from "@tiopkg/utils/array/toArray";
import identity from "@tiopkg/utils/function/identity";
import {execaOutput} from "./util";

const os = process.platform;

function resolve(paths: Record<string, (opts) => string | string[]>, opts) {
  return paths[os] ? toArray(paths[os](opts)).map(p => path.resolve(untildify(p))) : [];
}

// https://github.com/yarnpkg/yarn/issues/2049#issuecomment-263183768
const YARN_BASES = {
  'win32': ({APPDATA}) => `${APPDATA}/Yarn/config/global`,
  'darwin': () => '~/.config/yarn/global',
  'linux': () => '/usr/local/share/.config/yarn/global'
}

const NPM_ROOTS = {
  'win32': ({APPDATA}) => [`${APPDATA}/npm/node_modules`, `${APPDATA}/roaming/npm/node_modules`],
  'darwin': () => '/usr/local/lib/node_modules',
  'linux': () => '/usr/local/lib/node_modules'
}

export const resolveYarnBase = (ask?: boolean): string[] => {
  let result: string[];
  if (ask) {
    result = toArray(execaOutput('yarn', ['global', 'dir'], {encoding: 'utf8'}));
  } else {
    result = resolve(YARN_BASES, process.env);
  }
  return result.filter(identity).filter(f => fs.existsSync(f));
}
export const resolveNpmRoot = (ask?: boolean): string[] => {
  let result: string[];
  if (ask) {
    result = toArray(execaOutput('npm', ['root', '-g'], {encoding: 'utf8'}));
  } else {
    result = resolve(NPM_ROOTS, process.env);
  }
  return result.filter(identity).filter(f => fs.existsSync(f));
}
