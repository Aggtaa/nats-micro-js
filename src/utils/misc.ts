import { nanoid } from 'nanoid';

import { debug } from '../debug.js';
import { StatusError } from '../statusError.js';
import { Headers, headersPrefixContext, Subject } from '../types/index.js';

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

const addPrefix = (str: string, prefix: string) => `${prefix}${str}`;
const removePrefix = (str: string, prefix: string) => str.replace(prefix, '');
const isContextHeaderKey = (key: string) => key.startsWith(headersPrefixContext);

export const contextHeadersToObject = (headers: Headers): Record<string, unknown> => {
  const obj = {} as Record<string, unknown>;

  for (const [key, value] of headers)
    if (isContextHeaderKey(key))
      try {
        obj[removePrefix(key, headersPrefixContext)] = JSON.parse(value);
      }
      catch (error) {
        debug.ms.thread.warn(`Failed to parse context header '${key}' with value '${value}'`);
      }

  return obj;
};

export const objectToContextHeaders = (object: Record<string, unknown>): Headers => {
  const headers: string[][] = [];

  for (const [key, value] of Object.entries(object))
    headers.push([addPrefix(key, headersPrefixContext), JSON.stringify(value)]);

  return headers as Headers;
};
