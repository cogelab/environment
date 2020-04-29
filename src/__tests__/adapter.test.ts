import inquirer = require('inquirer');
import sinon = require('sinon');
import stripAnsi = require('strip-ansi');
import logSymbols = require("log-symbols");
import * as chalk from "chalk";
import {TerminalAdapter} from '../adapter';

describe('TerminalAdapter', () => {
  let adapter: TerminalAdapter;
  let sandbox;
  let stub;
  let fakePromise;


  beforeEach(function () {
    adapter = new TerminalAdapter();
  });

  describe('#prompt()', () => {
    beforeEach(function () {
      sandbox = sinon.createSandbox();
      fakePromise = {then: sinon.spy()};
      stub = sinon.stub().returns(fakePromise);
      sandbox.stub(inquirer, 'createPromptModule').returns(stub);
      adapter = new TerminalAdapter();
    });

    afterEach(function () {
      sandbox.restore();
    });

    it('pass its arguments to inquirer', function () {
      const questions = [];``
      const func = () => {};
      const ret = adapter.prompt(questions, func);
      sinon.assert.calledWith(stub, questions);
      sinon.assert.calledWith(fakePromise.then, func);
      expect(ret).toBe(fakePromise);
    });

    it('pass its arguments with answers to inquirer', function () {
      const questions = [];
      const answers = {};
      const func = () => {};
      const ret = adapter.prompt(questions, answers, func);
      sinon.assert.calledWith(stub, questions, answers);
      sinon.assert.calledWith(fakePromise.then, func);
      expect(ret).toBe(fakePromise);
    });
  });

  describe('#prompt() with answers', () => {
    it('pass its arguments to inquirer', function (done) {
      const questions = [];
      const answers = {prompt1: 'foo'};
      adapter.prompt(questions, answers).then(ret => {
        expect(ret.prompt1).toBe(answers.prompt1);
        done();
      });
    });
  });

  describe('#diff()', () => {
    it('returns properly colored diffs', function () {
      const diff = adapter.diff('var', 'let');
      expect(stripAnsi(diff)).toEqual('\nremoved added\n\nvarlet\n');
    });
  });

  describe('#log()', () => {
    let logMessage;
    let spyerror;
    const stderrWriteBackup = process.stderr.write;

    beforeEach(function () {
      spyerror = sinon.spy(adapter.console, 'error');

      logMessage = '';
      // @ts-ignore
      process.stderr.write = (() => {
        return str => {
          logMessage = str;
        };
      })();
    });

    afterEach(function () {
      // @ts-ignore
      adapter.console.error.restore();
      process.stderr.write = stderrWriteBackup;
    });

    it('calls console.error and perform strings interpolation', function () {
      adapter.logger.log('%has %many %reps', {
        has: 'has',
        many: 'many',
        reps: 'reps'
      });
      expect(spyerror.withArgs('has many reps').calledOnce).toBeTruthy();
      expect(stripAnsi(logMessage)).toBe('has many reps\n');
    });

    it('substitutes strings correctly when context argument is falsey', function () {
      adapter.logger.log('Zero = %d, One = %s', 0, 1);
      expect(spyerror.calledOnce).toBeTruthy();
      expect(stripAnsi(logMessage)).toBe('Zero = 0, One = 1\n');
    });

    it('boolean values', function () {
      adapter.logger.log(true);
      expect(spyerror.withArgs(true).calledOnce).toBeTruthy();
      expect(stripAnsi(logMessage)).toBe('true\n');
    });

    it('#write() numbers', function () {
      adapter.logger.log(42);
      expect(spyerror.withArgs(42).calledOnce).toBeTruthy();
      expect(stripAnsi(logMessage)).toBe('42\n');
    });

    it('#write() objects', function () {
      const outputObject = {
        something: 72,
        another: 12
      };

      adapter.logger.log(outputObject);
      expect(spyerror.withArgs(outputObject).calledOnce).toBeTruthy();
      expect(stripAnsi(logMessage)).toBe('{ something: 72, another: 12 }\n');
    });
  });

  describe('#log', () => {
    let spylog;
    beforeEach(function () {
      spylog = sinon.spy(process.stderr, 'write');
    });

    afterEach(() => {
      // @ts-ignore
      process.stderr.write.restore();
    });

    it('#write() pass strings as they are', function () {
      const testString = 'dummy';
      adapter.logger.write(testString);
      expect(spylog.withArgs(testString).calledOnce).toBeTruthy();
    });

    it('#write() accepts util#format style arguments', function () {
      adapter.logger.write('A number: %d, a string: %s', 1, 'bla');
      expect(spylog.withArgs('A number: 1, a string: bla').calledOnce).toBeTruthy();
    });

    it('#writeln() adds a \\n at the end', function () {
      adapter.logger.writeln('dummy');
      expect(spylog.withArgs('dummy').calledOnce).toBeTruthy();
      expect(spylog.withArgs('\n').calledOnce).toBeTruthy();
    });

    it('#colorful() writes colorful texts', function () {
      adapter.logger.colorful('{green dummy}');
      expect(spylog.withArgs(`${chalk.green('dummy')}\n`).calledOnce).toBeTruthy();
    });

    it('#ok() adds a green "✔ " at the beginning and \\n at the end', function () {
      adapter.logger.ok('dummy');
      expect(spylog.withArgs(`${logSymbols.success} dummy\n`).calledOnce).toBeTruthy();
    });

    it('#error() adds a green "✗ " at the beginning and \\n at the end', function () {
      adapter.logger.error('dummy');
      expect(spylog.withArgs(`${logSymbols.error} dummy\n`).calledOnce);
    });
  });
});
