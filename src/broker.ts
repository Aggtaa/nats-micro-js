import * as nats from 'nats';

import { debug } from './debug.js';
import { TokenEventEmitter } from './tokenEventEmitter.js';
import {
  RequestOptions, MessageMaybeReplyTo, SendOptions,
  Sender, Subject, RequestManyOptions,
} from './types/index.js';
import { errorToString, randomId } from './utils.js';

export type { ConnectionOptions } from 'nats';

export class Broker implements Sender {

  public clientId: number | undefined;

  private readonly ee = new TokenEventEmitter();
  private connection: nats.NatsConnection | undefined;
  private connectionClosedWaiter: Promise<void | Error> | undefined;
  // eslint-disable-next-line new-cap
  private readonly codec = nats.JSONCodec();
  private subscriptions: Record<string, nats.Subscription> = {};

  // eslint-disable-next-line no-useless-constructor, no-empty-function
  constructor(public readonly options: nats.ConnectionOptions) {
  }

  public async connect(): Promise<this> {
    debug.broker.info(`Connecting to ${this.options.servers} as "${this.options.name}"`);
    try {
      this.connection = await nats.connect(this.options);
      this.clientId = this.connection.info?.client_id;

      this.connectionClosedWaiter = this.connection.closed();
      debug.broker.info(`Connected as ${this.clientId}`);
      return this;
    }
    catch (err) {
      debug.broker.error(`Failed to connect: ${errorToString(err)}`);
      throw err;
    }
  }

  public async disconnect(): Promise<void> {
    debug.broker.info('Disconnecting from server');
    try {
      if (!this.connection) {
        debug.broker.info('Not connected to server');
        return;
      }
      await this.connection.close();
      this.subscriptions = {};
      const err = await this.connectionClosedWaiter;
      if (err)
        throw err;
      debug.broker.info('Disconnected from server');
    }
    catch (err) {
      debug.broker.error(`Error disconnecting from server: ${errorToString(err)}`);
      throw err;
    }
  }

  private decode(msg: nats.Msg): unknown {
    const str = msg.string();
    if (str === '')
      return '';

    return this.codec.decode(msg.data);
  }

  private handleMessageFromSubscription(
    err: nats.NatsError | null,
    msg: nats.Msg,
  ): void {
    if (err) {
      debug.broker.error(`Incoming error in message on "${msg.subject}": ${JSON.stringify(err)}`);
    }
    else {
      debug.broker.debug(`Incoming message on "${msg.subject}": ${JSON.stringify(msg.string())}`);
      try {
        this.ee.emit(
          msg.subject,
          {
            data: this.decode(msg),
            headers: msg.headers,
            replyTo: msg.reply,
          } as MessageMaybeReplyTo<unknown>,
        );
      }
      catch {
        let content: string;
        try {
          content = msg.string();
        }
        catch {
          content = `${msg.data.byteLength} bytes`;
        }
        debug.broker.error(`Error decoding JSON from "${content}"`);
      }
    }
  }

  private subscribe(
    subject: string,
    queue: string | undefined,
  ): nats.Subscription {
    if (!this.connection)
      throw new Error('Not connected');

    debug.broker.debug(`Subscribing to "${subject}"`);
    return this.connection.subscribe(
      subject,
      {
        queue,
        callback: this.handleMessageFromSubscription.bind(this),
      },
    );
  }

  private unsubscribe(
    subscription: nats.Subscription,
  ): void {
    if (!this.connection)
      throw new Error('Not connected');

    debug.broker.debug(`Unsubscribing from "${subscription.getSubject()}"`);
    subscription.unsubscribe();
  }

  public on<T>(
    subject: Subject,
    listener: (data: MessageMaybeReplyTo<T>, subject: string) => void,
    queue: string | undefined = undefined,
  ): void {
    const subj = this.subjectToStr(subject);
    if (!this.subscriptions[subj]) {
      this.subscriptions[subj] = this.subscribe(subj, queue);
    }
    this.ee.on(subj, listener);
  }

  public off<T>(
    subject: Subject,
    listener: (data: MessageMaybeReplyTo<T>, subject: string) => void,
  ): void {
    const subj = this.subjectToStr(subject);
    if (this.subscriptions[subj]) {
      this.unsubscribe(this.subscriptions[subj]);
      delete (this.subscriptions[subj]);
    }
    this.ee.off(subj, listener);
  }

  public async send<T>(
    subject: Subject,
    data: T,
    options?: SendOptions,
  ): Promise<void> {
    if (!this.connection)
      throw new Error('Not connected');

    const headers = nats.headers();
    if (options?.headers)
      for (const [k, vv] of options.headers)
        for (const v of vv)
          headers.append(k, v);

    await this.connection.publish(
      this.subjectToStr(subject),
      this.codec.encode(data),
      {
        headers,
        reply: (options && options.replyTo)
          ? options.replyTo
          : undefined,
      },
    );
  }

  public async* requestMany<T, R>(
    subject: Subject,
    data: T,
    options?: RequestManyOptions,
  ): AsyncIterableIterator<R> {
    if (!this.connection)
      throw new Error('Not connected');

    const timeout = options?.timeout ?? 30000;

    try {
      const responses = await this.connection.requestMany(
        this.subjectToStr(subject),
        this.codec.encode(data),
        {
          noMux: true,
          strategy: (options?.limit ?? 0) < 0
            ? nats.RequestStrategy.Timer
            : nats.RequestStrategy.Count,
          maxMessages: (options?.limit ?? 0) < 0
            ? undefined
            : options?.limit,
          maxWait: timeout,
          // reply: `_INBOX.${microservice}.${randomId()}`,
          // timeout,
        },
      );

      const iterator = responses[Symbol.asyncIterator]();
      let result = await iterator.next();
      while (!result.done) {
        yield this.codec.decode(result.value.data) as R;
        result = await iterator.next();
      }
    }
    catch (err) {
      if (typeof (err) === 'object' && err && 'code' in err && err.code === '503')
        return; // NATS no responders available

      throw err;
    }
  }

  public async request<T, R>(
    subject: Subject,
    data: T,
    options?: RequestOptions,
  ): Promise<R> {
    if (!this.connection)
      throw new Error('Not connected');

    const timeout = options?.timeout ?? 30000;

    const res = await this.connection.request(
      this.subjectToStr(subject),
      this.codec.encode(data),
      {
        noMux: true,
        reply: `_INBOX.${randomId()}`,
        timeout,
      },
    );
    return this.codec.decode(res.data) as R;
  }

  private subjectToStr(subject: Subject): string {
    if (typeof (subject) === 'string')
      return subject;

    if ('method' in subject) {
      if ('instance' in subject)
        return `${subject.microservice}.${subject.instance}.${subject.method}`;

      return `${subject.microservice}.${subject.method}`;
    }

    throw new Error('Unknown subject format');
  }
}
