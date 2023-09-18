import moment from 'moment';
import { isUndefined } from 'util';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { Broker } from '../broker.js';
import { localConfig } from '../localConfig.js';
import {
  BaseMethodData, BaseMicroserviceData, MessageHandler, MethodProfile,
  MicroserviceConfig, MicroserviceInfo, MicroserviceMethodConfig, MicroservicePing,
  MicroserviceRegistration, MicroserviceRegistrationSubject, MicroserviceSchema, MicroserviceStats,
} from '../types/index.js';
import {
  randomId, wrapMethod, wrapThread,
} from '../utils.js';

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
  private readonly handleSchemaWrap: MessageHandler<void>;
  private readonly handleInfoWrap: MessageHandler<void>;
  private readonly handlePingWrap: MessageHandler<void>;
  private readonly handleStatsWrap: MessageHandler<void>;

  constructor(
    private readonly broker: Broker,
    public readonly config: MicroserviceConfig,
  ) {
    this.startedAt = new Date();
    this.id = randomId();

    this.handleSchemaWrap = wrapMethod(this.broker, wrapThread(this.id, this.handleSchema.bind(this)), 'handleSchema');
    this.handleInfoWrap = wrapMethod(this.broker, wrapThread(this.id, this.handleInfo.bind(this)), 'handleInfo');
    this.handlePingWrap = wrapMethod(this.broker, wrapThread(this.id, this.handlePing.bind(this)), 'handlePing');
    this.handleStatsWrap = wrapMethod(this.broker, wrapThread(this.id, this.handleStats.bind(this)), 'handleStats');
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

  private async publishRegistration(state: MicroserviceRegistration['state']): Promise<void> {

    await this.broker.send(
      MicroserviceRegistrationSubject,
      {
        info: this.handleInfo(),
        state,
      } as MicroserviceRegistration,
    );
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
        '_nats.client.id': String(this.broker.clientId),
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

  private makeInfo(): MicroserviceInfo {

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
    return this.makeInfo();
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
