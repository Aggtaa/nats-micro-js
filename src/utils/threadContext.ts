import { AsyncLocalStorage } from 'async_hooks';

import { addPrefix, contextHeadersToObject } from './misc.js';
import { Headers, headersPrefixContext } from '../types/broker.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const threadContext = new AsyncLocalStorage<Map<string, any>>();
export const THREAD_CONTEXT_KEY_ADDITIONAL_HEADERS = 'additionalHeaders';
export const THREAD_CONTEXT_KEY_CONTEXT_HEADERS = 'context';

export function addThreadContextHeaders(headers?: Headers): Headers | undefined {
  const store = threadContext.getStore();

  if (!store)
    return headers;

  const allHeaders = Array.from(headers ?? [])
    .filter((header) =>
      header[0] !== THREAD_CONTEXT_KEY_ADDITIONAL_HEADERS &&
      header[0] !== THREAD_CONTEXT_KEY_CONTEXT_HEADERS);

  allHeaders.push(...(store.get(THREAD_CONTEXT_KEY_ADDITIONAL_HEADERS) ?? []));

  const contextHeaders = store.get(THREAD_CONTEXT_KEY_CONTEXT_HEADERS);

  Object.entries(contextHeaders ?? {}).forEach(([key, value]) =>
    allHeaders.push([addPrefix(key, headersPrefixContext), JSON.stringify(value)]));

  return allHeaders;
}

export const addContextHeadersToThreadContext = (headers?: Headers) => {
  const store = threadContext.getStore();
  store?.set(THREAD_CONTEXT_KEY_CONTEXT_HEADERS, contextHeadersToObject(headers ?? []));
};
