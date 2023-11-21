import { isUndefined } from 'util';

import { Handler, MicroserviceConfig, MicroserviceMethodConfig } from '../types/index.js';

export type StoredMicroserviceMethod<T, R> = {
  target: Handler<T, R>;
  name?: string;
  config: { name?: string; } & MicroserviceMethodConfig<T, R>;
};

export type StoredMicroservice = {
  target: unknown; // class constructor
  config: Omit<MicroserviceConfig, 'methods'>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  methods: StoredMicroserviceMethod<any, any>[];
};

export class Storage {

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public readonly microservices: StoredMicroservice[] = [];

  public ensureClassAdded(target: unknown): StoredMicroservice {
    const existing = this.microservices.find((ms) => ms.target === target);
    if (existing)
      return existing;

    const added: StoredMicroservice = {
      target: target,
      config: {
        name: '',
        description: '',
        version: '0.0.0',
        metadata: {},
      },
      methods: [],
    };
    this.microservices.push(added);
    return added;
  }

  public ensureClassMethodAdded<T, R>(
    targetClass: unknown,
    targetMethod: Handler<T, R>,
  ): StoredMicroserviceMethod<T, R> {
    const storedClass = this.ensureClassAdded(targetClass);
    const existing = storedClass.methods.find((m) => m.target === targetMethod);
    if (existing)
      return existing;

    const added: StoredMicroserviceMethod<T, R> = {
      target: targetMethod,
      config: {
        handler: targetMethod,
      },
    };
    storedClass.methods.push(added);
    return added;
  }

  getConfig<T extends object>(target: T): MicroserviceConfig | undefined {
    const constructor = Object.getPrototypeOf(target).constructor.prototype;
    const ms = this.microservices.find((m) => m.target === constructor);
    if (!ms)
      return undefined;

    const methods: MicroserviceConfig['methods'] = {};
    for (const method of ms.methods) {
      if (!isUndefined(method.name))
        methods[method.name] = method.config;
    }

    return {
      ...ms.config,
      methods,
    };
  }

  addMethod<T, R>(
    targetClass: unknown,
    targetMethod: Handler<T, R>,
    data: Partial<MicroserviceMethodConfig<T, R>>,
  ): void {

    const storedMethod = storage.ensureClassMethodAdded(targetClass, targetMethod);

    storedMethod.config = { ...storedMethod.config, ...data };
  }
}

export const storage = new Storage();
