import { Broker } from './broker';
import { Discovery, MicroserviceConfig, MicroserviceMethodConfig } from './discovery';
import { MaybePromise, wrapMethod } from './types';

export class Microservice {

  private readonly discovery: Discovery;

  constructor(
    protected readonly broker: Broker,
    config: MicroserviceConfig,
  ) {
    this.discovery = new Discovery(this.broker, config);
  }

  public static async create(
    broker: Broker,
    config: MicroserviceConfig,
  ): Promise<Microservice> {
    const ms = new Microservice(broker, config);

    await ms.init();

    return ms;
  }

  private initMethod<R, T>(name: string, method: MicroserviceMethodConfig<R, T>): void {

    this.broker.on<unknown>(
      this.discovery.getMethodSubject(name, method),
      wrapMethod(this.broker, this.profileMethod(name, method.handler)),
    );
  }

  public async init(): Promise<this> {

    await this.discovery.init();

    for (const [name, method] of Object.entries(this.discovery.config.methods))
      this.initMethod(name, method);

    return this;
  }

  public addMethod<R, T>(
    name: string,
    method: MicroserviceMethodConfig<R, T>,
  ): this {

    this.discovery.addMethod(name, method);
    this.initMethod(name, method);

    return this;
  }

  profileMethod<T, R>(
    name: string,
    method: (args: T) => MaybePromise<R>,
  ): (args: T) => MaybePromise<R> {
    return (args) => {
      const start = process.hrtime.bigint();
      try {
        const result = method(args);
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
          err.toString(),
          Number(elapsed),
        );
        throw err;
      }
    };
  }
}
