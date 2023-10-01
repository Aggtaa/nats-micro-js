import { threadContext } from 'debug-threads-ns';
import { nanoid } from 'nanoid';
import { isUndefined } from 'util';
import { ZodError } from 'zod';

import { Broker } from './broker.js';
import { debug } from './debug.js';
import {
  Handler, MessageHandler, MicroserviceMethodConfig, Subject,
} from './types/index.js';

export function randomId(): string {
  return nanoid(16);
}

export function camelCase(s: string) {
  return s.replace(/(?<=.)([A-Z])/g, '-$1').toLowerCase();
}

export function errorToString(error: unknown): string {
  if (typeof error === 'object' && error) {
    return 'message' in error ? String(error.message) : String(error);
  }

  return String(error);
}

export function wrapMethod<T, R>(
  broker: Broker,
  callback: Handler<T, R>,
  methodName: string,
): MessageHandler<T> {

  return async (msg, subject) => {
    debug.ms.thread.debug(`Executing ${methodName}(${JSON.stringify(msg.data)})`);

    const output: R = await callback(msg.data, { subject, headers: msg.headers });
    if (!isUndefined(output) && 'replyTo' in msg && msg.replyTo) {

      broker.send(
        msg.replyTo,
        output,
      );
    }
  };
}

export function wrapMethodSafe<T, R>(
  broker: Broker,
  callback: Handler<T, R>,
  methodName: string,
  method: MicroserviceMethodConfig<T, R>,
): MessageHandler<T> {

  return async (msg, subject) => {
    try {
      let input = msg.data;
      if (method.request) {
        try {
          input = method.request.parse(input);
        }
        catch (err) {
          if (err instanceof ZodError)
            throw new Error(`Invalid request type: ${err.issues[0].message}`);
          else
            throw err;
        }
      }

      debug.ms.thread.debug(`Executing ${methodName}(${JSON.stringify(msg.data)})`);

      let output: R = await callback(input, { subject, headers: msg.headers });
      if (!isUndefined(output) && 'replyTo' in msg && msg.replyTo) {

        if (method.response) {
          try {
            output = method.response.parse(output);
          }
          catch (err) {
            if (err instanceof ZodError)
              throw new Error(`Invalid response type: ${err.issues[0].message}`);
            else
              throw err;
          }
        }

        broker.send(
          msg.replyTo,
          output,
        );
      }
    }
    catch (err: unknown) {
      const error = errorToString(err);

      debug.error(error);

      if ('replyTo' in msg && msg.replyTo) {

        const headers: [string, string][] = [
          ...(
            (typeof (err) === 'object') && err && ('status' in err)
              ? [['X-Error-Status', String(err.status)] as [string, string]]
              : []
          ),
          ['X-Error-Message', error],
        ];

        broker.send(
          msg.replyTo,
          undefined,
          {
            headers,
          },
        );
      }
      // throw err;
    }
  };
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export type Action = (...args: any[]) => any;

export function wrapThread<T extends Action>(threadId: string, callback: T): T {
  threadContext.init(threadId);
  return callback;
}

export function subjectToStr(subject: Subject): string {
  if (typeof (subject) === 'string')
    return subject;

  if ('method' in subject) {
    if ('instance' in subject)
      return `${subject.microservice}.${subject.instance}.${subject.method}`;

    return `${subject.microservice}.${subject.method}`;
  }

  throw new Error('Unknown subject format');
}
