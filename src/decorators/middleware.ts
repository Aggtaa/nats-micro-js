/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Handler,
  MicroserviceMethodConfig, PartialBy,
} from '../types/index.js';
import { Middlewares } from '../types/middleware.js';

export type MethodDecoratorOptions<T, R> =
  { name?: string; } &
  PartialBy<Omit<MicroserviceMethodConfig<T, R>, 'handler'>, 'subject' | 'metadata'>;

type MethodDescriptor<T, R> = TypedPropertyDescriptor<Handler<T, R>>;

export function middleware<
  T = void,
  R = void,
>(middlewares: Middlewares<T, R>) {

  return <D extends MethodDescriptor<T, R>>(
    target: unknown,
    key: string | symbol,
    descriptor: D,
  ): D => {

    if (!descriptor.value)
      throw new Error('Use method decorators only on class methods');

    const oldCallback = descriptor.value;
    descriptor.value = (req, res) => {
      let allow: boolean = true;
      if ('pre' in middlewares) {
        for (const pre of middlewares.pre) {
          allow = pre(req, res);
          if (!allow)
            break;
        }
      }
      if (allow) {
        oldCallback(req, res);
        if ('post' in middlewares)
          for (const post of [...middlewares.post].reverse())
            post(req, res);
      }
    };

    return descriptor;
  };
}
