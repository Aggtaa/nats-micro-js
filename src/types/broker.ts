import { MaybePromise, PartialBy } from './types.js';

export type HandlerPayload = {
  subject: string;
  headers?: Iterable<[string, string]>;
}

export type Handler<T, R> = (data: T, payload: HandlerPayload) => MaybePromise<R>;

export type MicroserviceSubject = {
  microservice: string;
  instance?: string; // for calls to "local" methods
}

export type RawSubject = string;

export type MethodSubject = MicroserviceSubject & {
  method: string;
}

export type Subject = RawSubject | MethodSubject;

export type Message<T> = {
  data: T,
  headers?: Iterable<[string, string]>,
}

export type MessageReplyTo<T> = Message<T> & {
  replyTo: RawSubject,
}

export type MessageMaybeReplyTo<T> = PartialBy<MessageReplyTo<T>, 'replyTo'>;

export type MessageHandler<T> = (data: MessageMaybeReplyTo<T>, subject: string) => void;

export type BrokerResponse<T> = Message<T> & {
  subject: string;
  error?: Error;
}

export type RequestOptions = Pick<Message<unknown>, 'headers'> & {
  timeout?: number;
}

export type RequestManyOptions = RequestOptions & {
  limit?: number, // -1 for unlimited
}

export type SendOptions = Omit<MessageMaybeReplyTo<never>, 'data'>;
