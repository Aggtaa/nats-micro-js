import { AsyncLocalStorage } from 'async_hooks';
import { threadContext } from 'debug-threads-ns';

// eslint-disable-next-line import/no-cycle
export * from './callHandler.js';
export * from './misc.js';
export * from './wrapMethod.js';
export * from './wrapMethodSafe.js';

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export type Action = (...args: any[]) => any;

export function attachThreadContext<T extends Action>(threadId: string, callback: T): T {
  threadContext.init(threadId);
  return callback;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const asyncLocalStorage = new AsyncLocalStorage<Map<string, any>>();
export const ALS_KEY_ADDITIONAL_HEADERS = 'additionalHeaders';
