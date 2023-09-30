import {
  MessageHandler, RequestManyOptions, RequestOptions, SendOptions,
  Subject, BrokerResponse,
} from './types/broker.js';

export interface Broker {
  get clientId(): number | undefined;

  get name(): string;

  createInbox(): string;

  on<T>(
    subject: Subject,
    listener: MessageHandler<T>,
  ): void;
  on<T>(
    subject: Subject,
    listener: MessageHandler<T>,
    queue: string | undefined,
  ): void;

  off<T>(
    subject: Subject,
    listener: MessageHandler<T>,
  ): void;

  send<T>(
    subject: Subject,
    data: T,
    options?: SendOptions,
  ): Promise<void>;

  requestMany<T, R>(
    subject: Subject,
    data: T,
    options?: RequestManyOptions,
  ): AsyncIterable<BrokerResponse<R>>;

  request<T, R>(
    subject: Subject,
    data: T,
    options?: RequestOptions,
  ): Promise<BrokerResponse<R | undefined>>;
}
