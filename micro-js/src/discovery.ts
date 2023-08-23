import moment from 'moment';
import { isUndefined } from 'util';
import { z } from 'zod';

import { Broker } from './broker';
import { MaybePromise, wrapMethod } from './types';
import { randomId } from './utils';
import pjson from '../package.json';

// https://pkg.go.dev/github.com/nats-io/nats.go/micro

export type MicroserviceMethodConfig<T, R> = {
  handler: (args: T) => MaybePromise<R>,
  input?: z.ZodType<T>,
  output?: z.ZodType<R>,
}

export type MicroserviceConfig = {
  name: string;
  description: string;
  version: string;
  methods: Record<string, MicroserviceMethodConfig<unknown, unknown>>,
}

type BaseResponse = {
  id: string,
  name: string,
  version: string,
  metadata: {
    '_nats.client.created.library': string,
    '_nats.client.created.version': string,
  },
}

type PingResponse = BaseResponse & {
  type: 'io.nats.micro.v1.ping_response',
}

type EndpointInfo = {
  name: string,
  subject: string,
  metadata: unknown,
}

type InfoResponse = BaseResponse & {
  type: 'io.nats.micro.v1.info_response',
  description: string,
  endpoints: EndpointInfo[],
}

type EndpointProfile = {
  num_requests: number,
  num_errors: number,
  last_error: string,
  processing_time: number,
  average_processing_time: number,
}

type EndpointStats = EndpointProfile & {
  name: string,
  subject: string,
}

type StatsReponse = BaseResponse & {
  type: 'io.nats.micro.v1.stats_response',
  started: string,
  'endpoints': EndpointStats[],
}

const emptyMethodProfile: EndpointProfile = {
  num_requests: 0,
  num_errors: 0,
  last_error: '',
  processing_time: 0,
  average_processing_time: 0,
};

export class Discovery {

  public readonly id: string;
  public readonly startedAt: Date;
  public readonly methodStats: Record<string, EndpointProfile> = {};

  constructor(
    private readonly broker: Broker,
    public readonly config: MicroserviceConfig,
  ) {
    this.startedAt = new Date();
    this.id = randomId();
  }

  public async init(): Promise<this> {

    const handleInfo = wrapMethod(this.broker, this.handleInfo.bind(this));
    const handlePing = wrapMethod(this.broker, this.handlePing.bind(this));
    const handleStats = wrapMethod(this.broker, this.handleStats.bind(this));

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

  private makeResponse(): BaseResponse {
    return {
      name: this.config.name,
      id: this.id,
      version: this.config.version,
      metadata: {
        '_nats.client.created.library': pjson.name,
        '_nats.client.created.version': pjson.version,
      },
    };

  }

  private async handleInfo(): Promise<InfoResponse> {
    return {
      ...this.makeResponse(),
      description: this.config.description,
      type: 'io.nats.micro.v1.info_response',
      endpoints: Object.keys(this.config.methods)
        .map((n) => ({
          name: n,
          subject: `${this.config.name}.${n}`,
          metadata: null,
        })),
    };
  }

  private async handleStats(): Promise<StatsReponse> {
    return {
      ...this.makeResponse(),
      type: 'io.nats.micro.v1.stats_response',
      started: moment(this.startedAt).toISOString(),
      endpoints: Object.keys(this.config.methods)
        .map((n) => ({
          name: n,
          subject: `${this.config.name}.${n}`,
          ...(this.methodStats[n] ?? emptyMethodProfile),
        })),
    };
  }

  private async handlePing(): Promise<PingResponse> {
    return {
      ...this.makeResponse(),
      type: 'io.nats.micro.v1.ping_response',
    };
  }
}
