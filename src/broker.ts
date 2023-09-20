import {
  MessageHandler, RequestManyOptions, RequestOptions, SendOptions,
  Sender, Subject,
} from './types/broker.js';

export interface Broker extends Sender {
  get clientId(): number | undefined;

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
  ): AsyncIterable<R>;

  request<T, R>(
    subject: Subject,
    data: T,
    options?: RequestOptions,
  ): Promise<R>;
}
