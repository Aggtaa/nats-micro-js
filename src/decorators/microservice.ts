/* eslint-disable @typescript-eslint/no-explicit-any */

import { storage } from './storage.js';
import { MicroserviceConfig } from '../types/index.js';
import { camelCase } from '../utils.js';

export type MicroserviceDecoratorOptions =
  Partial<
    Pick<MicroserviceConfig,
      'name' | 'description' | 'version' | 'metadata'>
  >;

export function microservice<
  T,
  C extends any[],
>(
  options?: MicroserviceDecoratorOptions,
): any {
  return (
    target: { new(...args: C): T },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    context: any,
  ): { new(...args: C): T } | void => {

    const name = options?.name
      ?? camelCase(target.name.replace(/microservice/i, ''));

    const ms = storage.ensureAdded(target.prototype);

    ms.config = {
      ...ms.config,
      ...options,
      name,
      description: options?.description ?? '',
      version: options?.version ?? '0.0.0',
      metadata: options?.metadata ?? {},
    };
  };
}
