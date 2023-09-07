import { PartialBy } from './types';

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
  headers?: Iterable<[string, string[]]>,
}

export type MessageReplyTo<T> = Message<T> & {
  replyTo: RawSubject,
}

export type MessageMaybeReplyTo<T> = PartialBy<MessageReplyTo<T>, 'replyTo'>;

export type ExecOptions = {
  timeout: number;
}

export type SendOptions = Omit<MessageMaybeReplyTo<never>, 'data'>;

export interface Sender {
  send<T>(
    subject: Subject,
    data: T,
    options?: SendOptions,
  ): Promise<void>;
}
