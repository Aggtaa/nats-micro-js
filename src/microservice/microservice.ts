import { threadContext } from 'debug-threads-ns';

import { Discovery } from './discovery.js';
import { Broker } from '../broker.js';
import { debug } from '../debug.js';
import { storage } from '../decorators/storage.js';
import { MicroserviceConfig, MicroserviceMethodConfig } from '../types/index.js';
import { MaybePromise } from '../types/types.js';
import {
  MethodWrap, errorToString, wrapMethodSafe, wrapThread,
} from '../utils.js';

export class Microservice {

  private readonly discovery: Discovery;

  private readonly startedMethods: Record<string, MethodWrap<unknown>> = {};

  constructor(
    private readonly broker: Broker,
    config: MicroserviceConfig,
  ) {
    this.discovery = new Discovery(broker, config);
  }

  public static async create(
    broker: Broker,
    config: MicroserviceConfig,
  ): Promise<Microservice> {
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

  private async startMethod<R, T>(
    name: string,
    method: MicroserviceMethodConfig<R, T>,
  ): Promise<void> {
    const methodWrap = wrapMethodSafe(
      this.broker,
      wrapThread(this.discovery.id, this.profileMethod(name, method)),
      name,
      method,
    );

    this.startedMethods[name] = methodWrap as MethodWrap<unknown>;

    this.broker.on<R>(
      this.discovery.getMethodSubject(name, method, method.local),
      methodWrap,
      method.unbalanced || method.local ? undefined : 'q',
    );
  }

  private async stopMethod<R, T>(
    name: string,
    method: MicroserviceMethodConfig<R, T>,
  ): Promise<void> {

    this.broker.off<R>(
      this.discovery.getMethodSubject(name, method, method.local),
      this.startedMethods[name],
    );

    delete (this.startedMethods[name]);
  }

  public async start(): Promise<this> {

    threadContext.init(this.discovery.id);

    const cfg = this.discovery.config;

    debug.ms.thread.info(`Starting microservice ${cfg.name}(${Object.keys(cfg.methods).join(',')})`);

    await this.discovery.start();

    for (const [name, method] of Object.entries(cfg.methods))
      await this.startMethod(name, method);

    return this;
  }

  public async stop(): Promise<this> {

    threadContext.init(this.discovery.id);

    const cfg = this.discovery.config;

    debug.ms.thread.info(`Stopping microservice ${cfg.name}(${Object.keys(cfg.methods).join(',')})`);

    for (const [name, method] of Object.entries(cfg.methods))
      await this.stopMethod(name, method);

    await this.discovery.stop();

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
