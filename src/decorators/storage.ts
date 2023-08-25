import { MicroserviceConfig } from '../types';

export type StoredMicroservice = {
  constructor: unknown;
  config: MicroserviceConfig;
}

export class Storage {

  public readonly microservices: StoredMicroservice[] = [];

  public ensureAdded(constructor: unknown): StoredMicroservice {
    const existing = this.microservices.find((ms) => ms.constructor === constructor);
    if (existing)
      return existing;

    const added: StoredMicroservice = {
      constructor,
      config: {
        name: 'a',
        description: '',
        version: '',
        metadata: {},
        methods: {},
      },
    };
    this.microservices.push(added);
    return added;
  }

  getConfig<T extends object>(target: T): MicroserviceConfig | undefined {
    const constructor = Object.getPrototypeOf(target).constructor.prototype;
    const ms = this.microservices.find((m) => m.constructor === constructor);
    return ms?.config;
  }
}

export const storage = new Storage();
