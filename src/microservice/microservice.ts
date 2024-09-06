import { threadContext } from 'debug-threads-ns';
import EventEmitter from 'events';

import { Discovery } from './discovery.js';
import { Broker } from '../broker.js';
import { debug } from '../debug.js';
import { storage } from '../decorators/storage.js';
import {
  Handler, MessageHandler, MicroserviceConfig, MicroserviceMethodConfig,
} from '../types/index.js';
import {
  errorToString, attachThreadContext, wrapMethodSafe,
  asyncLocalStorage,
} from '../utils/index.js';

export type MicroserviceOptions = {
  noStopMethod?: boolean;
};

type StartedMethod<R, T> = {
  handler: MessageHandler<T>;
  config: MicroserviceMethodConfig<R, T>;
};

export class Microservice {

  private readonly ee = new EventEmitter();

  public readonly discovery: Discovery;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly startedMethods: Record<string, StartedMethod<any, any>> = {};

  constructor(
    public readonly broker: Broker,
    config: MicroserviceConfig | (() => MicroserviceConfig),
    private readonly options?: MicroserviceOptions,
  ) {
    this.discovery = new Discovery(
      broker,
      config,
      {
        transformConfig: this.options?.noStopMethod
          ? undefined
          : this.transformConfig.bind(this),
      },
    );
  }

  public static async create(
    broker: Broker,
    config: MicroserviceConfig | (() => MicroserviceConfig),
    options?: MicroserviceOptions,
  ): Promise<Microservice> {
    const ms = new Microservice(broker, config, options);
    await ms.start();
    return ms;
  }

  public static async createFromClass<T extends object>(
    broker: Broker,
    target: T,
    options?: MicroserviceOptions,
  ): Promise<Microservice> {
    const config = storage.getConfig(target);
    if (!config)
      throw new Error('Class not found');

    for (const method of Object.values(config.methods))
      method.handler = method.handler.bind(target);

    const service = await Microservice.create(broker, config, options);

    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    (target as any)['__microservice'] = service;

    return service;
  }

  public get id(): Readonly<string> {
    return Object.freeze(this.discovery.id);
  }

  public get config(): Readonly<MicroserviceConfig> {
    return Object.freeze(this.discovery.config);
  }

  public on(event: 'close', listener: () => void): void {
    this.ee.on(event, listener);
  }

  public off(event: 'close', listener: () => void): void {
    this.ee.off(event, listener);
  }

  private emit(event: 'close'): void {
    this.ee.emit(event);
  }

  private transformConfig(config: MicroserviceConfig): MicroserviceConfig {
    return {
      ...config,
      methods: {
        ...config.methods,

        microservice_stop: {
          handler: this.handleStop.bind(this),
          metadata: {
            'nats.micro.ext.v1.feature': 'microservice_stop',
            'nats.micro.ext.v1.feature.params': `{"name":"${config.name}","id":"${this.id}"}`,
          },
          unbalanced: true,
          local: true,
        },
      },
    };
  }

  private async startMethod<R, T>(
    name: string,
    method: MicroserviceMethodConfig<R, T>,
  ): Promise<void> {
    const methodWrap = wrapMethodSafe(
      this.broker,
      attachThreadContext(
        this.discovery.id,
        this.getProfiledMethodHandler(
          name,
          method,
        ),
      ),
      {
        microservice: this.config.name,
        method: name,
        methodConfig: method,
      },
    );

    const methodWrapAls: MessageHandler<R> = (...args) => {
      const store = new Map();
      asyncLocalStorage.enterWith(store);

      methodWrap(...args);
    };

    this.startedMethods[name] = {
      handler: methodWrapAls as MessageHandler<unknown>,
      config: method,
    };

    this.broker.on<R>(
      this.discovery.getMethodSubject(name, method),
      methodWrapAls,
      method.unbalanced || method.local ? undefined : 'q',
    );
  }

  private async stopMethod<R, T>(
    name: string,
    method: MicroserviceMethodConfig<R, T>,
  ): Promise<void> {

    this.broker.off<R>(
      this.discovery.getMethodSubject(name, method),
      this.startedMethods[name].handler,
    );

    delete (this.startedMethods[name]);
  }

  public async start(): Promise<this> {

    threadContext.init(this.discovery.id);

    const cfg = this.discovery.config;

    debug.ms.thread.info(`Starting microservice ${cfg.name}(${Object.keys(cfg.methods).join(',')})`);

    for (const [name, method] of Object.entries(cfg.methods))
      await this.startMethod(name, method);

    await this.discovery.start();

    return this;
  }

  public async restart(): Promise<this> {
    if (!this.discovery.isStarted)
      return this.start();

    threadContext.init(this.discovery.id);

    const cfg = this.discovery.config;

    debug.ms.thread.info(`Restarting microservice ${cfg.name}(${Object.keys(cfg.methods).join(',')})`);

    for (const [name, method] of Object.entries(this.startedMethods))
      await this.stopMethod(name, method.config);

    for (const [name, method] of Object.entries(cfg.methods))
      await this.startMethod(name, method);

    await this.discovery.publish();

    return this;
  }

  private async handleStop(): Promise<void> {
    this.emit('close');
    await this.stop();
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

  private getProfiledMethodHandler<T, R>(
    name: string,
    method: MicroserviceMethodConfig<T, R>,
  ): Handler<T, R> {
    return async (req, res): Promise<void> => {
      const start = process.hrtime.bigint();
      try {
        if (method.middlewares)
          for (const middleware of method.middlewares) {
            await middleware(req, res);
          }
        if (!res.isClosed) {
          await method.handler(req, res);
          if (method.postMiddlewares)
            for (const middleware of method.postMiddlewares) {
              await middleware(req, res);
            }
        }

        res.closeWaiter.catch((err) => {
          throw err;
        });

        res.closeWaiter.then(() => {
          const elapsed = process.hrtime.bigint() - start;
          this.discovery.profileMethod(
            name,
            undefined,
            Number(elapsed),
          );
        });
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
