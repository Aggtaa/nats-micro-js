import { threadContext } from 'debug-threads-ns';

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
