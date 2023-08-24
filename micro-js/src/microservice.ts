import { Broker } from './broker';
import { Discovery, MicroserviceConfig } from './discovery';
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

  // public registerListener<T>(
  //   subject: string,
  //   handler: (args: T) => MaybePromise<void>,
  //   params?: {
  //     input: z.ZodType<T>,
  //   }
  // ): this {

  //   // TODO
  //   // this.broker.on(
  //   //   this.discovery.config.name,
  //   //   `$ALL.${subject}`,
  //   //   this.wrapMethod(handler.bind(this))
  //   // )

  //   return this;
  // }

  public async init(): Promise<this> {

    await this.discovery.init();

    for (const [name, method] of Object.entries(this.discovery.config.methods)) {
      this.broker.on<unknown>(
        this.discovery.getMethodSubject(name, method),
        wrapMethod(this.broker, this.profileMethod(name, method.handler)),
      );
    }

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
