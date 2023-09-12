import moment from 'moment';
import { isUndefined } from 'util';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { Broker } from '../broker.js';
import { localConfig } from '../localConfig.js';
import {
  BaseMethodData, BaseMicroserviceData, MethodProfile, MicroserviceConfig,
  MicroserviceInfo, MicroserviceMethodConfig, MicroservicePing, MicroserviceRegistration, MicroserviceRegistrationSubject, MicroserviceSchema,
  MicroserviceStats,
} from '../types/index.js';
import { randomId, wrapMethod, wrapThread } from '../utils.js';

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

    const handleSchema = wrapMethod(this.broker, wrapThread(this.id, this.handleSchema.bind(this)), 'handleSchema');
    const handleInfo = wrapMethod(this.broker, wrapThread(this.id, this.handleInfo.bind(this)), 'handleInfo');
    const handlePing = wrapMethod(this.broker, wrapThread(this.id, this.handlePing.bind(this)), 'handlePing');
    const handleStats = wrapMethod(this.broker, wrapThread(this.id, this.handleStats.bind(this)), 'handleStats');

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


    await this.broker.send(
      MicroserviceRegistrationSubject,
      {
        info: this.handleInfo(),
      } as MicroserviceRegistration,
    )

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
      version: this.config.version ?? '0.0.0',
      metadata: {
        '_nats.client.created.library': 'nats-micro',
        '_nats.client.created.version': localConfig.version,
        '_nats.client.id': this.broker.clientId,
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
    local: boolean = false,
  ): string {
    if (method.subject)
      return method.subject;
    if (local)
      return `${this.config.name}.${this.id}.${name}`;
    return `${this.config.name}.${name}`;
  }

  private handleSchema(): MicroserviceSchema {
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

  private handleInfo(): MicroserviceInfo {

    return {
      ...this.makeMicroserviceData(),
      description: this.config.description,
      type: 'io.nats.micro.v1.info_response',
      endpoints: Object.entries(this.config.methods)
        .map(([n, m]) => {
          const metadata = { ...m.metadata };
          if (m.unbalanced)
            metadata['com.optimacros.nats.micro.v1.method.unbalanced'] = 'true';
          if (m.local)
            metadata['com.optimacros.nats.micro.v1.method.local'] = 'true';

          return {
            ...this.makeMethodData(n, m),
            metadata, // TODO maybe we should send NULL instead of empty object
          };
        }),
    };
  }

  private handleStats(): MicroserviceStats {
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
