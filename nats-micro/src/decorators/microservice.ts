/* eslint-disable @typescript-eslint/no-explicit-any */

import { storage } from './storage';
import { MicroserviceConfig } from '../types';
import { camelCase } from '../utils';

// export function microservice() {
//   console.log('microservice(): factory evaluated');
//   return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
//     console.log('microservice(): called');
//   };
// }

export type MicroserviceDecoratorOptions =
  Partial<Pick<MicroserviceConfig, 'name' | 'description' | 'version' | 'metadata'>>;

export function microservice(options?: MicroserviceDecoratorOptions) {
  return <T>(constructor: new () => T): new () => T => {

    const name = options?.name
      ?? camelCase(constructor.name.replace(/microservice/i, ''));

    const ms = storage.ensureAdded(constructor.prototype);

    ms.config = {
      ...ms.config,
      ...options,
      name,
      description: options?.description ?? '',
      version: options?.version ?? '',
      metadata: options?.metadata ?? {},
    };

    return constructor;
  };
}
