import { nanoid } from 'nanoid';

import { StatusError } from '../statusError.js';
import { Subject } from '../types/index.js';

export function randomId(): string {
  return nanoid(16);
}

export function camelCase(s: string) {
  return s.replace(/(?<=.)([A-Z])/g, '-$1').toLowerCase();
}

export function errorToString(error: unknown): string {
  if (typeof error === 'object' && error) {
    return 'message' in error ? String(error.message) : String(error);
  }

  return String(error);
}

export function subjectToStr(subject: Subject): string {
  if (typeof (subject) === 'string')
    return subject;

  if ('method' in subject) {
    if ('instance' in subject)
      return `${subject.microservice}.${subject.instance}.${subject.method}`;

    return `${subject.microservice}.${subject.method}`;
  }

  throw new Error('Unknown subject format');
}

export function errorFromHeaders(headers: [string, string][]): Error | undefined {
  const errorMessageHeader = headers.find((h) => h[0] === 'X-Error-Message');
  const errorStatusHeader = headers.find((h) => h[0] === 'X-Error-Status');
  if (errorMessageHeader) {
    if (errorStatusHeader)
      return new StatusError(errorStatusHeader[1], errorMessageHeader[1]);
    return new Error(errorMessageHeader[1]);
  }

  return undefined;
}
