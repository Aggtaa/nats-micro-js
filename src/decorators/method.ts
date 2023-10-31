/* eslint-disable @typescript-eslint/no-explicit-any */
import { storage } from './storage.js';
import {
  Handler,
  MicroserviceMethodConfig, PartialBy,
} from '../types/index.js';
import { camelCase } from '../utils.js';

export type MethodDecoratorOptions<T, R> =
  { name?: string; } &
  PartialBy<Omit<MicroserviceMethodConfig<T, R>, 'handler'>, 'subject' | 'metadata'>;

type MethodDescriptor<T, R> = TypedPropertyDescriptor<Handler<T, R>>;

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

    const storedMethod = storage.ensureClassMethodAdded(target, descriptor.value);
    storedMethod.name = options?.name ?? camelCase(String(key));
    storedMethod.config = {
      ...storedMethod.config,
      handler: descriptor.value,
      ...options,
    };

    return descriptor;
  };
}
