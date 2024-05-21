import { Handler, MicroserviceConfig, MicroserviceMethodConfig } from '../types/index.js';
import { kebabCase } from '../utils/misc.js';

type StoredMicroserviceClassMethod<T, R> = {
  method: Handler<T, R>;
  config: { name?: string; } & Omit<MicroserviceMethodConfig<T, R>, 'handler'>;
};

type StoredMicroserviceClass = {
  target: unknown; // class constructor
  config: Omit<MicroserviceConfig, 'methods'>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  methods: StoredMicroserviceClassMethod<any, any>[];
};

class ClassStorage {
  public readonly items: StoredMicroserviceClass[] = [];

  public ensureClassAdded(target: unknown): StoredMicroserviceClass {
    const existing = this.items.find((ms) => ms.target === target);
    if (existing)
      return existing;

    const added: StoredMicroserviceClass = {
      target: target,
      config: {
        name: '',
        description: '',
        version: '0.0.0',
        metadata: {},
      },
      methods: [],
    };
    this.items.push(added);
    return added;
  }

  public ensureClassMethodAdded<T, R>(
    targetClass: unknown,
    classMethod: Handler<T, R>,
  ): StoredMicroserviceClassMethod<T, R> {
    const storedClass = this.ensureClassAdded(targetClass);
    const existing = storedClass.methods.find((m) => m.method === classMethod);
    if (existing)
      return existing;

    const added: StoredMicroserviceClassMethod<T, R> = {
      method: classMethod,
      config: {},
    };
    storedClass.methods.push(added);
    return added;
  }

  getConfig<T extends object>(target: T): MicroserviceConfig | undefined {
    const constructor = Object.getPrototypeOf(target).constructor.prototype;
    const ms = this.items.find((m) => m.target === constructor);
    if (!ms)
      return undefined;

    const methods: MicroserviceConfig['methods'] = {};
    for (const method of ms.methods) {
      const methodName = method.config.name ?? kebabCase(method.method.name);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const targetMethod = (target as any)[method.method.name];
      if (!targetMethod)
        throw new Error(`Class method ${method.method.name} is missing in target object`);

      methods[methodName] = { ...method.config, handler: targetMethod };
    }

    return {
      ...ms.config,
      methods,
    };
  }
}

export const storage = new ClassStorage();
