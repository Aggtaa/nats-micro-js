import { nanoid } from 'nanoid';

import { THREAD_CONTEXT_KEY_ADDITIONAL_HEADERS, THREAD_CONTEXT_KEY_CONTEXT_HEADERS, threadContext } from './threadContext.js';
import { StatusError } from '../statusError.js';
import { Headers, headersPrefixContext } from '../types/broker.js';
import { Subject } from '../types/index.js';

export function randomId(): string {
  return nanoid(16);
}

export function kebabCase(s: string) {
  return s.replace(/(?<=.)([A-Z])/g, '-$1').toLowerCase();
}

export function errorToString(error: unknown): string {
  if (typeof error === 'object' && error) {
    return 'message' in error ? String(error.message) : JSON.stringify(error);
  }

  return String(error);
}

export function subjectToString(subject: Subject): string {
  if (typeof (subject) === 'string')
    return subject;

  if (typeof (subject) === 'object' && ('method' in subject)) {
    if ('instance' in subject)
      return `${subject.microservice}.${subject.instance}.${subject.method}`;

    return `${subject.microservice}.${subject.method}`;
  }

  throw new Error('Unknown subject format');
}

export function errorFromHeaders(
  headers: Iterable<[string, string]> | undefined,
): Error | undefined {
  if (!headers)
    return undefined;

  const headersArray = Array.from(headers);

  const errorMessageHeader = headersArray.find((h) => h[0] === 'X-Error-Message');
  const errorStatusHeader = headersArray.find((h) => h[0] === 'X-Error-Status');
  if (errorMessageHeader) {
    if (errorStatusHeader)
      return new StatusError(errorStatusHeader[1], errorMessageHeader[1]);
    return new Error(errorMessageHeader[1]);
  }

  return undefined;
}

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

const addPrefix = (str: string, prefix: string) => `${prefix}-${str}`;
const removePrefix = (str: string, prefix: string) => str.replace(prefix + '-', '');
const isContextHeaderKey = (key: string) => key.split('-')[0] === headersPrefixContext;

const contextHeadersToObject = (headers: Headers): Record<string, unknown> => {
  const obj = {} as Record<string, unknown>;

  for (const [key, value] of headers)
    if (isContextHeaderKey(key))
      obj[removePrefix(key, headersPrefixContext)] = JSON.parse(value);

  return obj;
};

export const addContextHeadersToThreadContext = (headers?: Headers) => {
  const store = threadContext.getStore();
  store?.set(THREAD_CONTEXT_KEY_CONTEXT_HEADERS, contextHeadersToObject(headers ?? []));
};
