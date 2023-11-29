import {
  Headers, noResponse, Response, ResponseData,
} from './types/index.js';
import { randomId } from './utils/misc.js';

export class ResponseImpl<R> implements Response<R> {

  private readonly resData: ResponseData<R> = {
    data: noResponse,
    headers: [],
  };

  public readonly id = randomId();
  private closeCallback: ((value: ResponseData<R>) => void) | undefined;

  get closeWaiter(): Promise<ResponseData<R>> {
    return new Promise((closedRes) => {
      this.closeCallback = closedRes;
      if (this.isClosed)
        closedRes(this.resData);
    });
  }

  _isClosed: boolean = false;

  get isClosed(): boolean {
    return this._isClosed;
  }

  setHeaders(responseHeaders: Headers): void {
    this.resData.headers = [];
    this.resData.headers.push(...Array.from(responseHeaders));
  }

  send(responseData: R): void {
    if (this.isClosed)
      return;
    this.resData.data = responseData;
    this._close();
  }

  sendNoResponse(): void {
    if (this.isClosed)
      return;
    this.resData.data = noResponse;
    this._close();
  }

  _close(): void {
    if (this._isClosed)
      return;

    this._isClosed = true;
    if (this.closeCallback)
      this.closeCallback(this.resData);
  }
}
