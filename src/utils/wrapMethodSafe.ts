import { ZodError } from 'zod';

// eslint-disable-next-line import/no-cycle
import { callHandler } from './callHandler.js';
import { errorToString } from './misc.js';
import { Broker } from '../broker.js';
import { debug } from '../debug.js';
import { Handler, MessageHandler, MicroserviceHandlerInfo } from '../types/index.js';

export function wrapMethodSafe<T, R>(
  broker: Broker,
  callback: Handler<T, R>,
  handlerInfo: MicroserviceHandlerInfo<T, R>,
): MessageHandler<T> {
  return async (msg, subject) => {
    try {
      let input = msg.data;
      if (handlerInfo.methodConfig.request) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((handlerInfo.methodConfig.request._def as any).typeName === 'ZodVoid')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          input = undefined as any;

        else
          try {
            input = handlerInfo.methodConfig.request.parse(input);
          }
          catch (err) {
            if (err instanceof ZodError)
              throw new Error(`Invalid request type: ${err.issues.map((i) => i.message).join(',')}`);

            throw err;
          }
      }

      debug.ms.thread.debug(`Executing safe ${handlerInfo.method}(${JSON.stringify(msg.data)})`);

      const output = await callHandler(
        callback,
        input,
        subject,
        msg.headers ?? [],
        handlerInfo,
      );

      if ((typeof (output.data) !== 'symbol') && 'replyTo' in msg && msg.replyTo) {
        if (handlerInfo.methodConfig.response) {
          try {
            output.data = handlerInfo.methodConfig.response.parse(output.data);
          }
          catch (err) {
            if (err instanceof ZodError)
              throw new Error(`Invalid response type: ${err.issues.map((i) => i.message).join(',')}`);

            else
              throw err;
          }
        }

        broker.send(
          msg.replyTo,
          output.data,
          {
            headers: output.headers,
          },
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
          'ERROR',
          {
            headers,
          },
        );
      }
      // throw err;
    }
  };
}
