import { nanoid } from 'nanoid';

// eslint-disable-next-line import/no-cycle
import { ALS_KEY_ADDITIONAL_HEADERS, asyncLocalStorage } from './index.js';
import { debug } from '../debug.js';
import { StatusError } from '../statusError.js';
import { Headers } from '../types/broker.js';
import { SendOptions, Subject } from '../types/index.js';

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

export function getSendHeaders(options?: SendOptions): Headers {
  const allHeaders = [];

  if (options?.headers)
    for (const [k, v] of options.headers)
      if (k !== ALS_KEY_ADDITIONAL_HEADERS)
        allHeaders.push([k, v]);

  const store = asyncLocalStorage.getStore();

  debug.broker.debug('getSendHeaders store', store);

  if (store)
    allHeaders.push(...(store.get(ALS_KEY_ADDITIONAL_HEADERS) ?? []));

  return allHeaders;
}
