import { Broker } from './broker';
import { Discovery } from './discovery';
import { MicroserviceConfig, MicroserviceMethodConfig } from './types';
import { MaybePromise } from './types/types';
import { wrapMethodSafe } from './utils';

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

  private startMethod<R, T>(name: string, method: MicroserviceMethodConfig<R, T>): void {

    this.broker.on<R>(
      this.discovery.getMethodSubject(name, method),
      wrapMethodSafe(this.broker, this.profileMethod(name, method), method),
    );
  }

  public async start(): Promise<this> {

    await this.discovery.start();

    for (const [name, method] of Object.entries(this.discovery.config.methods))
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
  ): (args: T) => MaybePromise<R> {
    return (args) => {
      const start = process.hrtime.bigint();
      try {
        const result = method.handler(args);
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
