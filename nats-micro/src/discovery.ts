import moment from 'moment';
import { isUndefined } from 'util';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { Broker } from './broker';
import { localConfig } from './localConfig';
import {
  BaseMethodData, BaseMicroserviceData, MethodProfile, MicroserviceConfig,
  MicroserviceInfo, MicroserviceMethodConfig, MicroservicePing, MicroserviceSchema,
  MicroserviceStats,
} from './types';
import { randomId, wrapMethod } from './utils';

const emptyMethodProfile: MethodProfile = {
  num_requests: 0,
  num_errors: 0,
  last_error: '',
  processing_time: 0,
  average_processing_time: 0,
};

export class Discovery {

  public readonly id: string;
  public readonly startedAt: Date;
  public readonly methodStats: Record<string, MethodProfile> = {};

  constructor(
    private readonly broker: Broker,
    public readonly config: MicroserviceConfig,
  ) {
    this.startedAt = new Date();
    this.id = randomId();
  }

  public async start(): Promise<this> {

    const handleSchema = wrapMethod(this.broker, this.handleSchema.bind(this));
    const handleInfo = wrapMethod(this.broker, this.handleInfo.bind(this));
    const handlePing = wrapMethod(this.broker, this.handlePing.bind(this));
    const handleStats = wrapMethod(this.broker, this.handleStats.bind(this));

    this.broker.on('$SRV.SCHEMA', handleSchema);
    this.broker.on(`$SRV.SCHEMA.${this.config.name}`, handleSchema);
    this.broker.on(`$SRV.SCHEMA.${this.config.name}.${this.id}`, handleSchema);

    this.broker.on('$SRV.INFO', handleInfo);
    this.broker.on(`$SRV.INFO.${this.config.name}`, handleInfo);
    this.broker.on(`$SRV.INFO.${this.config.name}.${this.id}`, handleInfo);

    this.broker.on('$SRV.PING', handlePing);
    this.broker.on(`$SRV.PING.${this.config.name}`, handlePing);
    this.broker.on(`$SRV.PING.${this.config.name}.${this.id}`, handlePing);

    this.broker.on('$SRV.STATS', handleStats);
    this.broker.on(`$SRV.STATS.${this.config.name}`, handleStats);
    this.broker.on(`$SRV.STATS.${this.config.name}.${this.id}`, handleStats);

    return this;
  }

  public addMethod<R, T>(
    name: string,
    method: MicroserviceMethodConfig<R, T>,
  ): void {
    this.config.methods[name] = method;
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
        '_nats.client.created.library': 'nats-micro',
        '_nats.client.created.version': localConfig.version,
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

  public getMethodSubject(
    name: string,
    method: MicroserviceMethodConfig<unknown, unknown>,
  ): string {
    if (method.subject)
      return method.subject;
    return `${this.config.name}.${name}`;
  }

  private async handleSchema(): Promise<MicroserviceSchema> {
    return {
      ...this.makeMicroserviceData(),
      type: 'io.nats.micro.v1.schema_response',
      endpoints: Object.entries(this.config.methods)
        .map(([n, m]) => ({
          ...this.makeMethodData(n, m),
          schema: {
            request: zodToJsonSchema(m.request ?? z.any()),
            response: zodToJsonSchema(m.response ?? z.void()),
          },
        })),
    };
  }

  private async handleInfo(): Promise<MicroserviceInfo> {
    return {
      ...this.makeMicroserviceData(),
      description: this.config.description,
      type: 'io.nats.micro.v1.info_response',
      endpoints: Object.entries(this.config.methods)
        .map(([n, m]) => ({
          ...this.makeMethodData(n, m),
          metadata: m.metadata ?? null,
        })),
    };
  }

  private async handleStats(): Promise<MicroserviceStats> {
    return {
      ...this.makeMicroserviceData(),
      type: 'io.nats.micro.v1.stats_response',
      started: moment(this.startedAt).toISOString(),
      endpoints: Object.entries(this.config.methods)
        .map(([n, m]) => ({
          ...this.makeMethodData(n, m),
          ...(this.methodStats[n] ?? emptyMethodProfile),
        })),
    };
  }

  private async handlePing(): Promise<MicroservicePing> {
    return {
      ...this.makeMicroserviceData(),
      type: 'io.nats.micro.v1.ping_response',
    };
  }
}
