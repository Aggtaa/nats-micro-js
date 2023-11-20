import EventEmitter from 'events';

import {
  Handler, Request, Headers, noResponse,
  HandlerInfo,
} from '../types/index.js';

export type ResponseData<R> = {
  data: R | symbol;
  headers: [string, string][];
};

export function callHandler<T, R>(
  handler: Handler<T, R>,
  data: T,
  subject: string,
  headers: Headers,
  handlerInfo: HandlerInfo,
): Promise<ResponseData<R>> {

  const req: Request<T> = {
    data,
    subject,
    headers,
    handler: handlerInfo,
  };

  const closeWaiter = new Promise<ResponseData<R>>((resolve, reject) => {

    const ee = new EventEmitter();

    const resData: ResponseData<R> = {
      data: noResponse,
      headers: [],
    };

    const res = new class {
      get closeWaiter(): Promise<void> {
        return new Promise((closedRes) => {
          if (this.isClosed)
            closedRes();
          else
            ee.once('closed', closedRes);
        });
      }

      _isClosed: boolean = false;

      get isClosed(): boolean {
        return this._isClosed;
      }

      setHeaders(responseHeaders: Headers): void {
        resData.headers = [];
        resData.headers.push(...Array.from(responseHeaders));
      }

      send(responseData: R): void {
        if (this.isClosed)
          return;
        resData.data = responseData;
        this._close();
      }

      sendNoResponse(): void {
        if (this.isClosed)
          return;
        resData.data = noResponse;
        this._close();
      }

      _close(): void {
        if (this._isClosed)
          return;
        this._isClosed = true;
        resolve(resData);
        ee.emit('closed');
      }
    }();

    try {
      handler(req, res);
      res._close();
    }
    catch (err) {
      reject(err);
    }
  });

  return closeWaiter;
}
