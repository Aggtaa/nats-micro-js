import { isUndefined } from 'util';

export type MaybePromise<T> = T | Promise<T>;

export type PartialBy<T, K extends keyof T> =
  Omit<T, K> & Partial<Pick<T, K>>;

export type MicroserviceSubject = {
  microservice: string; // undefined for local
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

export function wrapMethod<T, R>(
  broker: Sender,
  method: (args: T) => MaybePromise<R>,
): (msg: MessageMaybeReplyTo<T>) => void {

  return async (msg) => {

    const result = await method(msg.data);
    if (!isUndefined(result) && 'replyTo' in msg && msg.replyTo) {
      broker.send(
        msg.replyTo,
        result,
      );
    }
  };
}
