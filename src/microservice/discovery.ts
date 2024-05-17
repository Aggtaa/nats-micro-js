import moment from 'moment';
import { isUndefined } from 'util';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { JsonSchema7Type } from 'zod-to-json-schema/src/parseDef.js';

import { Broker } from '../broker.js';
import { localConfig } from '../localConfig.js';
import {
  BaseMethodData, BaseMicroserviceData, Handler, MessageHandler, MethodProfile,
  MicroserviceConfig, MicroserviceInfo, MicroserviceMethodConfig, MicroservicePing,
  MicroserviceRegistration, MicroserviceRegistrationSubject, MicroserviceSchema, MicroserviceStats,
  Request, Response,
} from '../types/index.js';
import {
  randomId, wrapMethod, attachThreadContext,
} from '../utils/index.js';

const emptyMethodProfile: MethodProfile = {
  num_requests: 0,
  num_errors: 0,
  last_error: '',
  processing_time: 0,
  average_processing_time: 0,
};

export type DiscoveryOptions = {
  transformConfig?: (config: MicroserviceConfig) => MicroserviceConfig;
};

export class Discovery {

  public readonly id: string;
  public readonly startedAt: Date;
  public readonly methodStats: Record<string, MethodProfile> = {};
  private readonly handleSchemaWrap: MessageHandler<void>;
  private readonly handleInfoWrap: MessageHandler<void>;
  private readonly handlePingWrap: MessageHandler<void>;
  private readonly handleStatsWrap: MessageHandler<void>;

  constructor(
    private readonly broker: Broker,
    private readonly configOrGetter: MicroserviceConfig | (() => MicroserviceConfig),
    private readonly options: DiscoveryOptions = {},
  ) {
    this.startedAt = new Date();
    this.id = randomId();

    const wrap = <T, R>(handler: Handler<T, R>, name: string) => wrapMethod(
      this.broker,
      attachThreadContext(this.id, handler.bind(this)),
      { microservice: this.originalConfig.name, method: name },
    );

    this.handleSchemaWrap = wrap(this.handleSchema, 'handleSchema');
    this.handleInfoWrap = wrap(this.handleInfo, 'handleInfo');
    this.handlePingWrap = wrap(this.handlePing, 'handlePing');
    this.handleStatsWrap = wrap(this.handleStats, 'handleStats');
  }

  public get originalConfig(): MicroserviceConfig {
    if (typeof (this.configOrGetter) === 'function')
      return this.configOrGetter();

    return this.configOrGetter;
  }

  public get config(): MicroserviceConfig {
    let config = this.originalConfig;
    if (this.options.transformConfig)
      config = this.options.transformConfig(config);

    return config;
  }

  public async start(): Promise<this> {

    this.broker.on('$SRV.SCHEMA', this.handleSchemaWrap);
    this.broker.on(`$SRV.SCHEMA.${this.config.name}`, this.handleSchemaWrap);
    this.broker.on(`$SRV.SCHEMA.${this.config.name}.${this.id}`, this.handleSchemaWrap);

    this.broker.on('$SRV.INFO', this.handleInfoWrap);
    this.broker.on(`$SRV.INFO.${this.config.name}`, this.handleInfoWrap);
    this.broker.on(`$SRV.INFO.${this.config.name}.${this.id}`, this.handleInfoWrap);

    this.broker.on('$SRV.PING', this.handlePingWrap);
    this.broker.on(`$SRV.PING.${this.config.name}`, this.handlePingWrap);
    this.broker.on(`$SRV.PING.${this.config.name}.${this.id}`, this.handlePingWrap);

    this.broker.on('$SRV.STATS', this.handleStatsWrap);
    this.broker.on(`$SRV.STATS.${this.config.name}`, this.handleStatsWrap);
    this.broker.on(`$SRV.STATS.${this.config.name}.${this.id}`, this.handleStatsWrap);

    await this.publishRegistration('up');

    return this;
  }

  public async stop(): Promise<this> {
    await this.publishRegistration('down');

    this.broker.off('$SRV.SCHEMA', this.handleSchemaWrap);
    this.broker.off(`$SRV.SCHEMA.${this.config.name}`, this.handleSchemaWrap);
    this.broker.off(`$SRV.SCHEMA.${this.config.name}.${this.id}`, this.handleSchemaWrap);

    this.broker.off('$SRV.INFO', this.handleInfoWrap);
    this.broker.off(`$SRV.INFO.${this.config.name}`, this.handleInfoWrap);
    this.broker.off(`$SRV.INFO.${this.config.name}.${this.id}`, this.handleInfoWrap);

    this.broker.off('$SRV.PING', this.handlePingWrap);
    this.broker.off(`$SRV.PING.${this.config.name}`, this.handlePingWrap);
    this.broker.off(`$SRV.PING.${this.config.name}.${this.id}`, this.handlePingWrap);

    this.broker.off('$SRV.STATS', this.handleStatsWrap);
    this.broker.off(`$SRV.STATS.${this.config.name}`, this.handleStatsWrap);
    this.broker.off(`$SRV.STATS.${this.config.name}.${this.id}`, this.handleStatsWrap);

    return this;
  }

  public async publish(): Promise<void> {
    await this.publishRegistration('up');
  }

  private async publishRegistration(state: MicroserviceRegistration['state']): Promise<void> {

    await this.broker.send(
      MicroserviceRegistrationSubject,
      {
        info: this.makeInfo(),
        state,
      } as MicroserviceRegistration,
    );
  }

  public profileMethod(
    name: string,
    error: string | undefined,
    time: number,
  ): void {
    if (!this.methodStats[name])
      this.methodStats[name] = { ...emptyMethodProfile };

    const method = this.methodStats[name];
    method.num_requests++;
    if (!isUndefined(error)) {
      method.num_errors++;
      method.last_error = error;
    }
    method.processing_time += time;
    method.average_processing_time =
      Math.round(Number(method.processing_time) / method.num_requests);
  }

  private makeMicroserviceData(): BaseMicroserviceData {
    return {
      name: this.config.name,
      id: this.id,
      version: this.config.version,
      metadata: {
        '_nats.client.created.library': localConfig.name,
        '_nats.client.created.version': localConfig.version,
        '_nats.client.id': String(this.broker.clientId),
        ...(!isUndefined(this.broker.name)
          ? { 'nats.micro.ext.v1.service.node': this.broker.name }
          : {}
        ),
        ...this.config.metadata,
      },
    };
  }

  private makeMethodData(
    name: string,
    method: MicroserviceMethodConfig<unknown, unknown>,
  ): BaseMethodData {
    return {
      name: name,
      subject: this.getMethodSubject(name, method),
    };
  }

  public getMethodSubject<R, T>(
    name: string,
    method: MicroserviceMethodConfig<R, T>,
  ): string {
    if (method.subject)
      return method.subject;
    if (method.local)
      return `${this.config.name}.${this.id}.${name}`;
    return `${this.config.name}.${name}`;
  }

  public makeInfo(): MicroserviceInfo {

    return {
      ...this.makeMicroserviceData(),
      description: this.config.description,
      type: 'io.nats.micro.v1.info_response',
      endpoints: Object.entries(this.config.methods)
        .map(([n, m]) => {
          const metadata = { ...m.metadata };
          if (m.unbalanced)
            metadata['nats.micro.ext.v1.method.unbalanced'] = 'true';
          if (m.local)
            metadata['nats.micro.ext.v1.method.local'] = 'true';

          return {
            ...this.makeMethodData(n, m),
            metadata, // TODO maybe we should send NULL instead of empty object
          };
        }),
    };
  }

  public getMethodSchema<T, R>(
    name: string,
    kind: keyof Pick<MicroserviceMethodConfig<T, R>, 'request' | 'response'>,
  ): z.ZodType | undefined {
    const method = this.config.methods[name];
    return method ? (method[kind] ?? z.void()) : undefined;
  }

  public getMethodJsonSchema<T, R>(
    name: string,
    kind: keyof Pick<MicroserviceMethodConfig<T, R>, 'request' | 'response'>,
  ): JsonSchema7Type | undefined {
    const schema = this.getMethodSchema(name, kind);
    return schema ? zodToJsonSchema(schema) : undefined;
  }

  private handleSchema(_req: Request<void>, res: Response<MicroserviceSchema>): void {
    res.send({
      ...this.makeMicroserviceData(),
      type: 'io.nats.micro.v1.schema_response',
      endpoints: Object.entries(this.config.methods)
        .map(([n, m]) => ({
          ...this.makeMethodData(n, m),
          schema: {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            request: this.getMethodJsonSchema(n, 'request')!,
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            response: this.getMethodJsonSchema(n, 'response')!,
          },
        })),
    });
  }

  private handleInfo(_req: Request<void>, res: Response<MicroserviceInfo>): void {
    res.send(this.makeInfo());
  }

  private handleStats(_req: Request<void>, res: Response<MicroserviceStats>): void {
    res.send({
      ...this.makeMicroserviceData(),
      type: 'io.nats.micro.v1.stats_response',
      started: moment(this.startedAt).toISOString(),
      endpoints: Object.entries(this.config.methods)
        .map(([n, m]) => ({
          ...this.makeMethodData(n, m),
          ...(this.methodStats[n] ?? emptyMethodProfile),
        })),
    });
  }

  private handlePing(_req: Request<void>, res: Response<MicroservicePing>): void {
    res.send({
      ...this.makeMicroserviceData(),
      type: 'io.nats.micro.v1.ping_response',
    });
  }
}
