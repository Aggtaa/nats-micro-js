import { PartialBy } from './types.js';

export type Headers = Iterable<[string, string]>;

export type HandlerInfo = {
  microservice?: string;
  method: string;
};

export type Request<T> = {
  data: T;
  subject: string;
  headers?: Headers;
  handler: HandlerInfo;
};

export const noResponse = Symbol('no reponse');

export type Response<R> = {
  send: (data: R, headers?: Headers) => void;
  end: () => void;
};

export type EncapsulatedResponse<R> = Response<R> & {
  _data: R | symbol,
  _headers: Headers,
};

export type Handler<T, R, RR = void> = (req: Request<T>, res: Response<R>) => RR;

export type MicroserviceSubject = {
  microservice: string;
  instance?: string; // for calls to "local" methods
};

export type RawSubject = string;

export type MethodSubject = MicroserviceSubject & {
  method: string;
};

export type Subject = RawSubject | MethodSubject;

export type Message<T> = {
  data: T,
  headers?: Headers,
};

export type MessageReplyTo<T> = Message<T> & {
  replyTo: RawSubject,
};

export type MessageMaybeReplyTo<T> = PartialBy<MessageReplyTo<T>, 'replyTo'>;

export type MessageHandler<T> = (data: MessageMaybeReplyTo<T>, subject: string) => void;

export type BrokerResponse<T> = Message<T> & {
  subject: string;
  error?: Error;
};

export type RequestOptions = Pick<Message<unknown>, 'headers'> & {
  timeout?: number;
};

export type RequestManyOptions = RequestOptions & {
  limit?: number, // -1 for unlimited
};

export type SendOptions = Omit<MessageMaybeReplyTo<never>, 'data'>;
