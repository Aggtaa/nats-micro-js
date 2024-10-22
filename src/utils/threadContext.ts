import { AsyncLocalStorage } from 'async_hooks';

import { addPrefix, contextHeadersToObject } from './misc.js';
import { Headers, headersPrefixContext } from '../types/broker.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const threadContext = new AsyncLocalStorage<Map<string, any>>();

export enum ThreadContextKey {
  additionalHeaders = 'additionalHeaders',
  context = 'context'
}

export function addThreadContextHeaders(headers?: Headers): Headers | undefined {
  const store = threadContext.getStore();

  if (!store)
    return headers;

  const allHeaders = Array.from(headers ?? [])
    .filter((header) =>
      header[0] !== ThreadContextKey.additionalHeaders &&
      header[0] !== ThreadContextKey.context);

  allHeaders.push(...(store.get(ThreadContextKey.additionalHeaders) ?? []));

  const contextHeaders = store.get(ThreadContextKey.context);

  Object.entries(contextHeaders ?? {}).forEach(([key, value]) =>
    allHeaders.push([addPrefix(key, headersPrefixContext), JSON.stringify(value)]));

  return allHeaders;
}

export const addContextHeadersToThreadContext = (headers?: Headers) => {
  const store = threadContext.getStore();
  store?.set(ThreadContextKey.context, contextHeadersToObject(headers ?? []));
};
