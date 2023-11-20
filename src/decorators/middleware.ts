/* eslint-disable @typescript-eslint/no-explicit-any */
import { storage } from './storage.js';
import { MethodDescriptor, Middleware } from '../types/index.js';

export function middleware<
  T = void,
  R = void,
>(...middlewares: Middleware<T, R>[]) {

  return <D extends MethodDescriptor<T, R>>(
    target: unknown,
    key: string | symbol,
    descriptor: D,
  ): D => {

    if (!descriptor.value)
      throw new Error('Use method decorators only on class methods');

    const storedMethod = storage.ensureClassMethodAdded(target, descriptor.value);
    storedMethod.config = {
      ...storedMethod.config,
      middlewares: [...(storedMethod.config.middlewares ?? []), ...middlewares],
    };

    return descriptor;
  };
}