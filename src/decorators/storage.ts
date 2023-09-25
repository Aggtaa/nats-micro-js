import { MicroserviceConfig } from '../types/index.js';

export type StoredMicroservice<T> = {
  constructor: unknown;
  config: MicroserviceConfig<T>;
}

export class Storage {

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public readonly microservices: StoredMicroservice<any>[] = [];

  public ensureAdded<T>(constructor: unknown): StoredMicroservice<T> {
    const existing = this.microservices.find((ms) => ms.constructor === constructor);
    if (existing)
      return existing;

    const added: StoredMicroservice<T> = {
      constructor,
      config: {
        name: '',
        description: '',
        version: '0.0.0',
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
