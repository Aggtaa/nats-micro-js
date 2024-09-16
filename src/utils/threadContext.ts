import { AsyncLocalStorage } from 'async_hooks';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const threadContext = new AsyncLocalStorage<Map<string, any>>();
export const THREAD_CONTEXT_KEY_ADDITIONAL_HEADERS = 'additionalHeaders';
