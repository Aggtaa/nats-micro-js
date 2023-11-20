import { z } from 'zod';

import { Handler, HandlerInfo } from './broker.js';
import { Middleware } from './middleware.js';

// https://pkg.go.dev/github.com/nats-io/nats.go/micro

export type MicroserviceMethodConfig<T, R> = {
  handler: Handler<T, R>;
  middlewares?: Middleware<T, R>[];
  subject?: string;
  metadata?: Record<string, string>;
  request?: z.ZodType<T>;
  response?: z.ZodType<R>;
  unbalanced?: boolean;
  local?: boolean;
};

export type MicroserviceConfig = {
  name: string;
  description: string;
  version: string;
  metadata?: Record<string, string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  methods: Record<string, MicroserviceMethodConfig<any, any>>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // middlewares?: Middleware<any, any>[];
};

export type MicroserviceHandlerInfo<T, R> = HandlerInfo & {
  methodConfig: MicroserviceMethodConfig<T, R>;
};

export type BaseMicroserviceData = {
  id: string,
  name: string,
  version: string,
  metadata: {
    '_nats.client.id': string,
    '_nats.client.created.library': string,
    '_nats.client.created.version': string,
  },
};

export type BaseMethodData = {
  name: string,
  subject: string,
};

export type MicroservicePing = BaseMicroserviceData & {
  type: 'io.nats.micro.v1.ping_response',
};

export type MethodInfo = BaseMethodData & {
  metadata: Record<string, string>,
};

export type MicroserviceInfo = BaseMicroserviceData & {
  type: 'io.nats.micro.v1.info_response',
  description: string,
  endpoints: MethodInfo[],
};

export type MethodProfile = {
  num_requests: number,
  num_errors: number,
  last_error: string,
  processing_time: number,
  average_processing_time: number,
};

export type MethodStats = BaseMethodData & MethodProfile;

export type MicroserviceStats = BaseMicroserviceData & {
  type: 'io.nats.micro.v1.stats_response',
  started: string,
  endpoints: MethodStats[],
};

export type MethodSchema = BaseMethodData & {
  schema: {
    request: Record<string, unknown>,
    response: Record<string, unknown>,
  },
};

export type MicroserviceSchema = BaseMicroserviceData & {
  type: 'io.nats.micro.v1.schema_response',
  // api_url?: string, // what is this?
  endpoints: MethodSchema[],
};
