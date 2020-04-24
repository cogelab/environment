import util = require('util');
import table = require('text-table');
import chalk = require('chalk');
import logSymbols = require('log-symbols');

import {mergeDeep} from "@tiopkg/utils/object/mergeDeep";
import {WriteStream} from "tty";

// Padding step
let padding = ' ';

function pad(status) {
  const max = 'identical'.length;
  const delta = max - status.length;
  return delta ? ' '.repeat(delta) + status : status;
}

// Borrowed from https://github.com/mikeal/logref/blob/master/main.js#L6-15
function formatter(msg, ctx) {
  while (msg.includes('%')) {
    const start = msg.indexOf('%');
    let end = msg.indexOf(' ', start);

    if (end === -1) {
      end = msg.length;
    }

    msg = msg.slice(0, start) + ctx[msg.slice(start + 1, end)] + msg.slice(end);
  }

  return msg;
}

const DEFAULT_COLORS = () => ({
  skip: 'yellow',
  force: 'yellow',
  create: 'green',
  invoke: 'bold',
  conflict: 'red',
  identical: 'cyan',
  info: 'gray'
});

export interface LogColors {
  skip: string
  force: string
  create: string
  invoke: string
  conflict: string
  identical: string
  info: string
  [color: string]: string;
}

export interface LogParams {
  colors?: Partial<LogColors>;
  stderr?: WriteStream;
  stdout?: WriteStream;
  console?: Console;
}

export type LogTableRow = Array<{ [name: string]: any }>;

export interface LogTableParams {
  rows: LogTableRow[];
}

export type LogTableOptions = LogTableRow[] | Partial<LogTableParams>;

export class Logger {
  colors: Partial<LogColors>;
  stderr: WriteStream;
  console: Console;

  constructor(opts?: Partial<LogParams>) {
    const params = mergeDeep({colors: DEFAULT_COLORS()}, opts);

    this.colors = params.colors!;
    this.stderr = params.stderr || params.stdout || process.stderr;
    this.console = params.console || console;
  }

  // A basic wrapper around `cli-table` package, resetting any single
  // char to empty strings, this is used for aligning options and
  // arguments without too much Math on our side.
  //
  // - opts - A list of rows or an Hash of options to pass through cli
  //          table.
  //
  // Returns the table representation
  static table(opts: LogTableOptions) {
    const tableData: LogTableRow[] = [];

    const params = Array.isArray(opts) ? {rows: opts} : opts;
    params.rows = params.rows || [];

    for (const row of params.rows) {
      tableData.push(row);
    }

    return table(tableData);
  };

  // `this.log` is a [logref](https://github.com/mikeal/logref)
  // compatible logger, with an enhanced API.
  //
  // It also has EventEmitter like capabilities, so you can call on / emit
  // on it, namely used to increase or decrease the padding.
  //
  // All logs are done against STDERR, letting you stdout for meaningfull
  // value and redirection, should you need to generate output this way.
  //
  // Log functions take two arguments, a message and a context. For any
  // other kind of paramters, `console.error` is used, so all of the
  // console format string goodies you're used to work fine.
  //
  // - msg      - The message to show up
  // - context  - The optional context to escape the message against
  //
  // @param {Object} params
  // @param {Object} params.colors status mappings
  //
  // Returns the logger
  log(msg: any, ...args) {
    msg = msg || '';

    const ctx = args[0];
    if (typeof ctx === 'object' && !Array.isArray(ctx)) {
      this.console.error(formatter(msg, ctx));
    } else {
      this.console.error.apply(this.console, arguments);
    }

    return this;
  }

  // A simple write method, with formatted message.
  //
  // Returns the logger
  write(...args: any[]) {
    this.stderr.write(util.format.apply(util, arguments));
    return this;
  };

  // Same as `log.write()` but automatically appends a `\n` at the end
  // of the message.
  writeln(...args) {
    this.write.apply(this, arguments);
    this.write('\n');
    return this;
  };

  // Convenience helper to write sucess status, this simply prepends the
  // message with a gren `✔`.
  ok(...args) {
    this.write(logSymbols.success + ' ' + util.format.apply(util, arguments) + '\n');
    return this;
  };

  error(...args) {
    this.write(logSymbols.error + ' ' + util.format.apply(util, arguments) + '\n');
    return this;
  };

  status(status: string, ...args) {
    status = pad(status);
    const color = this.colors[status];
    if (color) {
      status = chalk[color](status);
    }
    this.write(status).write(padding);
    this.write(util.format.apply(util, args) + '\n');
    return this;
  }

}