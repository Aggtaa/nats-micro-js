/* eslint-disable @typescript-eslint/no-explicit-any */
import { storage } from './storage.js';
import {
  MethodDecoratorOptions,
  MethodDescriptor,
} from '../types/index.js';

export function method<
  T = void,
  R = void,
>(options?: MethodDecoratorOptions<T, R>) {

  return <D extends MethodDescriptor<T, R>>(
    target: unknown,
    key: string | symbol,
    descriptor: D,
  ): D => {

    if (!descriptor.value)
      throw new Error('Use method decorators only on class methods');

    const storedMethod =
      storage.ensureClassMethodAdded<T, R>(target, descriptor.value);
    // storedMethod.name = methodName;
    storedMethod.config = {
      ...storedMethod.config,
      ...options,
    };

    return descriptor;
  };
}
