import { ResponseImpl } from '../response.js';
import {
  Handler, Request, Headers, HandlerInfo,
  ResponseData,
} from '../types/index.js';

export async function callHandler<T, R>(
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
  const res = new ResponseImpl<R>();

  await handler(req, res);

  return res.closeWaiter;
}
