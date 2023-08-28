import errio from 'errio';
import nanoid from 'nanoid-esm';
import { isUndefined } from 'util';
import { ZodError } from 'zod';

import { log } from './log';
import {
  MaybePromise, MessageMaybeReplyTo, MicroserviceMethodConfig, Sender,
} from './types';

export function randomId(): string {
  return nanoid(16);
}

export function camelCase(s: string) {
  return s.replace(/(?<=.)([A-Z])/g, '-$1').toLowerCase();
}

export function wrapMethod<T, R>(
  broker: Sender,
  callback: (args: T) => MaybePromise<R>,
): (msg: MessageMaybeReplyTo<T>) => void {

  return async (msg) => {
    const output: R = await callback(msg.data);
    if (!isUndefined(output) && 'replyTo' in msg && msg.replyTo) {

      broker.send(
        msg.replyTo,
        output,
      );
    }
  };
}

export function wrapMethodSafe<T, R>(
  broker: Sender,
  callback: (args: T) => MaybePromise<R>,
  method: MicroserviceMethodConfig<T, R>,
): (msg: MessageMaybeReplyTo<T>) => void {

  return async (msg) => {
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

      let output: R = await callback(input);
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
    catch (err) {
      const error = err.message ?? errio.stringify(err);

      log.error(error);

      if ('replyTo' in msg && msg.replyTo) {
        broker.send(
          msg.replyTo,
          { error },
        );
      }
      // throw err;
    }
  };
}
