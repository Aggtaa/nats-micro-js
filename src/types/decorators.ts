import { Handler } from './broker.js';
import { MicroserviceConfig, MicroserviceMethodConfig } from './discovery.js';
import { PartialBy } from './types.js';

export type MethodDecoratorOptions<T, R> =
  { name?: string; } &
  PartialBy<Omit<MicroserviceMethodConfig<T, R>, 'handler'>, 'subject' | 'metadata'>;

export type MethodDescriptor<T, R> =
  | TypedPropertyDescriptor<Handler<T, R, void>>
  | TypedPropertyDescriptor<Handler<T, R, PromiseLike<void>>>;

export type MicroserviceDecoratorOptions =
  Partial<
    Pick<MicroserviceConfig,
      'name' | 'description' | 'version' | 'metadata'>
  >;
