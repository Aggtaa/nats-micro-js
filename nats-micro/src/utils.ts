import errio from 'errio';
import nanoid from 'nanoid-esm';
import { isUndefined } from 'util';

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
        input = method.request.parse(input);
      }

      let output: R = await callback(input);
      if (!isUndefined(output) && 'replyTo' in msg && msg.replyTo) {

        if (method.response) {
          output = method.response.parse(output);
        }

        broker.send(
          msg.replyTo,
          output,
        );
      }
    }
    catch (err) {
      log.error(errio.stringify(err));
      // throw err;
    }
  };
}
