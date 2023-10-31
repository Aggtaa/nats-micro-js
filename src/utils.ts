import { threadContext } from 'debug-threads-ns';
import { nanoid } from 'nanoid';
import { ZodError } from 'zod';

import { Broker } from './broker.js';
import { debug } from './debug.js';
import { StatusError } from './statusError.js';
import {
  Handler, MessageHandler, Subject,
  Request, Headers, EncapsulatedResponse, noResponse,
  HandlerInfo,
  MicroserviceHandlerInfo,
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

function callHandler<T, R>(
  handler: Handler<T, R>,
  data: T,
  subject: string,
  headers: Headers,
  handlerInfo: HandlerInfo,
): Promise<EncapsulatedResponse<R> | symbol> {

  const req: Request<T> = {
    data,
    subject,
    headers,
    handler: handlerInfo,
  };

  return new Promise((resolve) => {
    const res: EncapsulatedResponse<R> = new class {
      _data: R | symbol = noResponse;
      _headers: [string, string][] = [];

      send(responseData: R, responseHeaders?: Headers): void {
        this._data = responseData;
        if (responseHeaders)
          this._headers.push(...Array.from(responseHeaders));
        resolve(res);
      }

      end(): void {
        resolve(noResponse);
      }
    }();

    handler(req, res);
  });
}

export function wrapMethod<T, R>(
  broker: Broker,
  callback: Handler<T, R>,
  handlerInfo: HandlerInfo,
): MessageHandler<T> {

  return async (msg, subject) => {
    debug.ms.thread.debug(`Executing ${handlerInfo.method}(${JSON.stringify(msg.data)})`);

    const output = await callHandler(callback, msg.data, subject, msg.headers ?? [], handlerInfo);

    if ((typeof (output) !== 'symbol') && 'replyTo' in msg && msg.replyTo) {
      broker.send(
        msg.replyTo,
        output._data,
        {
          headers: output._headers,
        },
      );
    }
  };
}

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

      debug.ms.thread.debug(`Executing ${handlerInfo.method}(${JSON.stringify(msg.data)})`);

      const output = await callHandler(
        callback,
        input,
        subject,
        msg.headers ?? [],
        handlerInfo,
      );

      if ((typeof (output) !== 'symbol') && 'replyTo' in msg && msg.replyTo) {
        if (handlerInfo.methodConfig.response) {
          try {
            output._data = handlerInfo.methodConfig.response.parse(output._data);
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
          output._data,
          {
            headers: output._headers,
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

export function errorFromHeaders(headers: [string, string][]): Error | undefined {
  const errorMessageHeader = headers.find((h) => h[0] === 'X-Error-Message');
  const errorStatusHeader = headers.find((h) => h[0] === 'X-Error-Status');
  if (errorMessageHeader) {
    if (errorStatusHeader)
      return new StatusError(errorStatusHeader[1], errorMessageHeader[1]);
    return new Error(errorMessageHeader[1]);
  }

  return undefined;
}
