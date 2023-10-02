/* eslint-disable @typescript-eslint/no-explicit-any */
import { storage } from './storage.js';
import { MicroserviceMethodConfig, PartialBy } from '../types/index.js';
import { camelCase } from '../utils.js';

export type MethodDecoratorOptions<T, R> =
  { name?: string } &
  PartialBy<Omit<MicroserviceMethodConfig<T, R>, 'handler'>, 'subject' | 'metadata'>;

type AsyncMethod<T, R> = T extends void
  ? (() => Promise<R>)
  : ((request: T) => Promise<R>);
type SyncMethod<T, R> = T extends void
  ? (() => R)
  : ((request: T) => R);

type MethodDescriptor<
  T,
  R,
> = TypedPropertyDescriptor<AsyncMethod<T, R>> |
  TypedPropertyDescriptor<SyncMethod<T, R>>;

export function method<
  T = void,
  R = void,
>(options?: MethodDecoratorOptions<T, R>) {

  return <D extends MethodDescriptor<T, R>>(
    target: unknown,
    key: string | symbol,
    descriptor: D,
  ): D => {

    const name = options?.name ?? camelCase(String(key));

    if (!descriptor.value)
      throw new Error('Use method decorators only on class methods');

    const ms = storage.ensureAdded(target);

    ms.config.methods[name] = {
      handler: descriptor.value,
      ...options,
    };

    return descriptor;
  };
}
