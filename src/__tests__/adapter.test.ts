import assert = require('yeoman-assert');
import inquirer = require('inquirer');
import sinon = require('sinon');
import stripAnsi = require('strip-ansi');
import logSymbols = require("log-symbols");
import {TerminalAdapter} from '../adapter';
import * as chalk from "chalk";

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
      const questions = [];
      const func = () => {};
      const ret = adapter.prompt(questions, func);
      sinon.assert.calledWith(stub, questions);
      sinon.assert.calledWith(fakePromise.then, func);
      assert.equal(ret, fakePromise);
    });

    it('pass its arguments with answers to inquirer', function () {
      const questions = [];
      const answers = {};
      const func = () => {};
      const ret = adapter.prompt(questions, answers, func);
      sinon.assert.calledWith(stub, questions, answers);
      sinon.assert.calledWith(fakePromise.then, func);
      assert.equal(ret, fakePromise);
    });
  });

  describe('#prompt() with answers', () => {
    it('pass its arguments to inquirer', function (done) {
      const questions = [];
      const answers = {prompt1: 'foo'};
      adapter.prompt(questions, answers).then(ret => {
        assert.equal(ret.prompt1, answers.prompt1);
        done();
      });
    });
  });

  describe('#diff()', () => {
    it('returns properly colored diffs', function () {
      const diff = adapter.diff('var', 'let');
      assert.textEqual(stripAnsi(diff), '\nremoved added\n\nvarlet\n');
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
      assert(spyerror.withArgs('has many reps').calledOnce);
      assert.equal(stripAnsi(logMessage), 'has many reps\n');
    });

    it('substitutes strings correctly when context argument is falsey', function () {
      adapter.logger.log('Zero = %d, One = %s', 0, 1);
      assert(spyerror.calledOnce);
      assert.equal(stripAnsi(logMessage), 'Zero = 0, One = 1\n');
    });

    it('boolean values', function () {
      adapter.logger.log(true);
      assert(spyerror.withArgs(true).calledOnce);
      assert.equal(stripAnsi(logMessage), 'true\n');
    });

    it('#write() numbers', function () {
      adapter.logger.log(42);
      assert(spyerror.withArgs(42).calledOnce);
      assert.equal(stripAnsi(logMessage), '42\n');
    });

    it('#write() objects', function () {
      const outputObject = {
        something: 72,
        another: 12
      };

      adapter.logger.log(outputObject);
      assert(spyerror.withArgs(outputObject).calledOnce);
      assert.equal(
        stripAnsi(logMessage),
        '{ something: 72, another: 12 }\n'
      );
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
      assert(spylog.withArgs(testString).calledOnce);
    });

    it('#write() accepts util#format style arguments', function () {
      adapter.logger.write('A number: %d, a string: %s', 1, 'bla');
      assert(spylog.withArgs('A number: 1, a string: bla').calledOnce);
    });

    it('#writeln() adds a \\n at the end', function () {
      adapter.logger.writeln('dummy');
      assert(spylog.withArgs('dummy').calledOnce);
      assert(spylog.withArgs('\n').calledOnce);
    });

    it('#colorful() writes colorful texts', function () {
      adapter.logger.colorful('{green dummy}');
      assert(spylog.withArgs(`${chalk.green('dummy')}\n`).calledOnce);
    });

    it('#ok() adds a green "✔ " at the beginning and \\n at the end', function () {
      adapter.logger.ok('dummy');
      assert(spylog.withArgs(`${logSymbols.success} dummy\n`).calledOnce);
    });

    it('#error() adds a green "✗ " at the beginning and \\n at the end', function () {
      adapter.logger.error('dummy');
      assert(spylog.withArgs(`${logSymbols.error} dummy\n`).calledOnce);
    });
  });
});
