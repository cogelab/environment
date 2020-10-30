import util = require('util');
import table = require('text-table');
import chalk = require('chalk');
import logSymbols = require('log-symbols');

import {mergeDeep} from "@loopx/utils/object/mergeDeep";
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
  inject: 'magenta',
  info: 'gray',
});

export interface BuiltinLogColors {
  skip: string
  force: string
  create: string
  invoke: string
  conflict: string
  identical: string
  inject: string;
  info: string;
}

export interface LogColors extends BuiltinLogColors {
  [c: string]: string;
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

export type StatusLogger<T> = {
  [p in keyof BuiltinLogColors]: ((...args: any[]) => T);
};

export class Logger implements StatusLogger<Logger> {
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

  colorful(...args) {
    this.write(chalkish`${util.format.apply(util, arguments)}` + '\n');
    return this;
  }

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

  status(status: keyof LogColors, ...args) {
    const color = this.colors[status];
    status = pad(status);
    if (color) {
      status = chalk[color](status);
    }
    this.write(status).write(padding);
    this.write(util.format.apply(util, args) + '\n');
    return this;
  }

  conflict(...args: any[]): Logger {
    return this.status('conflict', ...args);
  }

  create(...args: any[]): Logger {
    return this.status('create', ...args);
  }

  force(...args: any[]): Logger {
    return this.status('force', ...args);
  }

  identical(...args: any[]): Logger {
    return this.status('identical', ...args);
  }

  info(...args: any[]): Logger {
    return this.status('info', ...args);
  }

  inject(...args: any[]): Logger {
    return this.status('inject', ...args);
  }

  invoke(...args: any[]): Logger {
    return this.status('invoke', ...args);
  }

  skip(...args: any[]): Logger {
    return this.status('skip', ...args);
  }

}

function chalkish(parts: TemplateStringsArray, ...substitutions) {

  const rawResults: string[] = [];
  const cookedResults: string[] = [];

  const partsLength = parts.length;
  const substitutionsLength = substitutions.length;

  for (let i = 0; i < partsLength; i++) {
    rawResults.push(parts.raw[i]);
    cookedResults.push(parts[i]);

    if (i < substitutionsLength) {
      rawResults.push(substitutions[i]);
      cookedResults.push(substitutions[i]);
    }
  }

  // Now that we have all the generator parts and the value substitutions from the
  // original string, we can build the SINGLE value that we pass onto chalk. This
  // will cause chalk to evaluate the original generator as if it were a static
  // string (rather than a set of value substitutions).
  const chalkParts: any = [cookedResults.join("")];
  chalkParts.raw = [rawResults.join("")];

  return (chalk(chalkParts));
}
