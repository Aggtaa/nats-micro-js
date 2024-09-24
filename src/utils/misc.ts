import { nanoid } from 'nanoid';

import { THREAD_CONTEXT_KEY_ADDITIONAL_HEADERS, threadContext } from './threadContext.js';
import { StatusError } from '../statusError.js';
import { Headers } from '../types/broker.js';
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

export function addThreadContextHeaders(headers?: Headers | undefined): Headers {
  const allHeaders = [];

  Array.from(headers ?? [])
    .filter((header) => header[0] !== THREAD_CONTEXT_KEY_ADDITIONAL_HEADERS)
    .forEach((header) => allHeaders.push(header));

  const store = threadContext.getStore();

  allHeaders.push(...(store?.get(THREAD_CONTEXT_KEY_ADDITIONAL_HEADERS) ?? []));

  return allHeaders;
}
