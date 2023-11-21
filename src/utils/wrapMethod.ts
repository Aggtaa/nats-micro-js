import { callHandler } from './callHandler.js';
import { Broker } from '../broker.js';
import { debug } from '../debug.js';
import {
  Handler, MessageHandler, HandlerInfo,
} from '../types/index.js';

export function wrapMethod<T, R>(
  broker: Broker,
  callback: Handler<T, R>,
  handlerInfo: HandlerInfo,
): MessageHandler<T> {

  return async (msg, subject) => {
    debug.ms.thread.debug(`Executing ${handlerInfo.method}(${JSON.stringify(msg.data)})`);

    const output = await callHandler(
      callback,
      msg.data,
      subject,
      msg.headers ?? [],
      handlerInfo,
    );

    if ((typeof (output.data) !== 'symbol') && 'replyTo' in msg && msg.replyTo) {
      broker.send(
        msg.replyTo,
        output.data,
        {
          headers: output.headers,
        },
      );
    }
  };
}
