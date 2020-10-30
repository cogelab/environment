import execa = require('execa');
import replace from "@loopx/utils/string/replace";

/**
 * Create a "sloppy" copy of an initial Environment object. The focus of this method is on
 * performance rather than correctly deep copying every property or recreating a correct
 * instance. Use carefully and don't rely on `hasOwnProperty` of the copied environment.
 *
 * Every property are shared except the runLoop which is regenerated.
 *
 * @param {Environment} initialEnv - an Environment instance
 * @return {Environment} sloppy copy of the initial Environment
 */
export function duplicateEnv(initialEnv) {
  // Hack: Create a clone of the environment with a new instance of `runLoop`
  return Object.create(initialEnv);
}

export function execaOutput(cmd: string, args?: string[], options?): string {
  try {
    const result = execa.sync(cmd, args, options);
    if (!result.failed) {
      return cleanAnsi(result.stdout);
    }
  } catch (_) {
  }
  return '';
}

export function cleanAnsi(s: string) {
  return replace(ansiRegex(), '', s);
}

export function ansiRegex({onlyFirst = false} = {}) {
  const pattern = [
    '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
    '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))'
  ].join('|');

  return new RegExp(pattern, onlyFirst ? undefined : 'g');
}
