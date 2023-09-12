import { threadContext } from 'debug-threads-ns';

import { Discovery } from './discovery.js';
import { Broker } from '../broker.js';
import { debug } from '../debug.js';
import { storage } from '../decorators/storage.js';
import { MicroserviceConfig, MicroserviceMethodConfig, MicroserviceRegistration } from '../types/index.js';
import { MaybePromise } from '../types/types.js';
import { errorToString, wrapMethodSafe, wrapThread } from '../utils.js';

export class Microservice {

  private readonly discovery: Discovery;

  constructor(
    private readonly broker: Broker,
    config: MicroserviceConfig,
  ) {
    this.discovery = new Discovery(broker, config);
  }

  public static async create(broker: Broker, config: MicroserviceConfig): Promise<Microservice> {
    const ms = new Microservice(broker, config);
    await ms.start();
    return ms;
  }

  public static async createFromClass<T extends object>(
    broker: Broker,
    target: T,
  ): Promise<Microservice> {
    const config = storage.getConfig(target);
    if (!config)
      throw new Error('Class not found');

    for (const method of Object.values(config.methods))
      method.handler = method.handler.bind(target);

    return Microservice.create(broker, config);
  }

  private startMethod<R, T>(
    name: string,
    method: MicroserviceMethodConfig<R, T>,
  ): void {
    const methodWrap = wrapMethodSafe(
      this.broker,
      wrapThread(this.discovery.id, this.profileMethod(name, method)),
      name,
      method,
    );

    if (method.local) {
      this.broker.on<R>(
        this.discovery.getMethodSubject(name, method, true),
        methodWrap,
      );
    }
    else {
      this.broker.on<R>(
        this.discovery.getMethodSubject(name, method),
        methodWrap,
        method.unbalanced ? undefined : 'q',
      );
    }

  }

  public async start(): Promise<this> {

    threadContext.init(this.discovery.id);

    const cfg = this.discovery.config;

    debug.ms.thread.info(`Registering microservice ${cfg.name}(${Object.keys(cfg.methods).join(',')})`);

    await this.discovery.start();

    for (const [name, method] of Object.entries(cfg.methods))
      this.startMethod(name, method);

    return this;
  }

  public addMethod<R, T>(
    name: string,
    method: MicroserviceMethodConfig<R, T>,
  ): this {

    this.discovery.addMethod(name, method);
    this.startMethod(name, method);

    return this;
  }

  profileMethod<T, R>(
    name: string,
    method: MicroserviceMethodConfig<T, R>,
  ): (args: T, subject: string) => MaybePromise<R> {
    return (args, subject) => {
      const start = process.hrtime.bigint();
      try {
        const result = method.handler(args, subject);
        const elapsed = process.hrtime.bigint() - start;
        this.discovery.profileMethod(
          name,
          undefined,
          Number(elapsed),
        );
        return result;
      }
      catch (err) {
        const elapsed = process.hrtime.bigint() - start;
        this.discovery.profileMethod(
          name,
          errorToString(err),
          Number(elapsed),
        );
        throw err;
      }
    };
  }
}
