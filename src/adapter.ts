import inquirer = require('inquirer');
import diff = require('diff');
import chalk = require('chalk');
import {Logger} from "./log";
import {ReadStream, WriteStream} from "tty";
import {Console} from "console";

export interface PromptModule<T> {
  (questions: object | object[], answers?: T): Promise<T>;
}

export type PromptCallback<T> = (answers: T) => void;

export interface Adapter {
  prompt<T>(questions: object | object[], cb?: PromptCallback<T>): Promise<T>;

  prompt<T>(questions: object | object[], answers: T, cb?: PromptCallback<T>): Promise<T>;

  diff(actual: string, expected: string): string;
}

export interface TerminalAdapterOptions {
  stdin?: ReadStream;
  stdout?: WriteStream;
  stderr?: WriteStream;
  console?: Console;
}

/**
 * `TerminalAdapter` is the default implementation of `Adapter`, an abstraction
 * layer that defines the I/O interactions.
 *
 * It provides a CLI interaction
 *
 * @constructor
 */
export class TerminalAdapter implements Adapter {
  promptModule: PromptModule<any>;
  console: Console;
  log: Logger;

  constructor(options?: TerminalAdapterOptions) {
    options = options || {};
    const stdout = options.stdout || process.stdout;
    const stderr = options.stderr || options.stdout || process.stderr;

    this.promptModule = inquirer.createPromptModule({skipTTYChecks: true, input: options.stdin, output: stdout});
    this.console = options.console || new Console(stdout, stderr);
    this.log = new Logger({console: this.console, stdout: options.stdout});
  }

  get _colorDiffAdded() {
    return chalk.black.bgGreen;
  }

  get _colorDiffRemoved() {
    return chalk.bgRed;
  }

  _colorLines(name, str) {
    return str.split('\n').map(line => this[`_colorDiff${name}`](line)).join('\n');
  }

  /**
   * Prompt a user for one or more questions and pass
   * the answer(s) to the provided callback.
   *
   * It shares its interface with `Base.prompt`
   *
   * (Defined inside the constructor to keep interfaces separated between
   * instances)
   *
   */
  prompt<T>(questions: object | object[], answers?: T | PromptCallback<T>, cb?: PromptCallback<T>): Promise<T> {
    if (typeof answers === "function") {
      cb = <PromptCallback<T>>answers;
      answers = undefined;
    }
    const promise = this.promptModule(questions, answers);
    promise.then(cb);
    return promise;
  }

  /**
   * Shows a color-based diff of two strings
   *
   * @param {string} actual
   * @param {string} expected
   */
  diff(actual, expected) {
    let msg = diff.diffLines(actual, expected).map(str => {
      if (str.added) {
        return this._colorLines('Added', str.value);
      }

      if (str.removed) {
        return this._colorLines('Removed', str.value);
      }

      return str.value;
    }).join('');

    // Legend
    msg = '\n' +
      this._colorDiffRemoved('removed') +
      ' ' +
      this._colorDiffAdded('added') +
      '\n\n' +
      msg +
      '\n';

    console.log(msg);
    return msg;
  }
}
