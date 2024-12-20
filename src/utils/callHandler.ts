import { ThreadContextKey, threadContext } from './threadContext.js';
import { ResponseImpl } from '../response.js';
import {
  Handler, Request, Headers, HandlerInfo,
  ResponseData,
  RequestContext,
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
    get context() {
      return threadContext.getStore()?.get(ThreadContextKey.context);
    },
    set context(ctx: RequestContext) {
      const store = threadContext.getStore();

      if (!store)
        throw new Error('Thread context is not available');

      store.set(ThreadContextKey.context, ctx);
    },
  };
  const res = new ResponseImpl<R>();

  await handler(req, res);

  return res.closeWaiter;
}
