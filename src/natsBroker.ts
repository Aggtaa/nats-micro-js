import * as nats from 'nats';

import { Broker } from './broker.js';
import { debug } from './debug.js';
import { TokenEventEmitter } from './tokenEventEmitter.js';
import {
  RequestOptions, SendOptions, BrokerResponse,
  Subject, RequestManyOptions, MessageHandler,
  Headers,
} from './types/broker.js';
import {
  errorFromHeaders, errorToString, randomId, subjectToStr,
} from './utils.js';

export type { ConnectionOptions } from 'nats';

export class NatsBroker implements Broker {

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

  public get name(): string {
    return this.options.name ?? (process.env.MICROSERVICE_NODE_NAME ?? '');
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

  public createInbox(): string {
    return nats.createInbox();
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
            headers: this.decodeHeaders(msg.headers),
            replyTo: msg.reply,
          },
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

  private encodeHeaders(headers?: Headers): nats.MsgHdrs {

    const result = nats.headers();
    if (headers)
      for (const [k, v] of headers)
        result.append(k, v);

    return result;
  }

  private decodeHeaders(headers?: nats.MsgHdrs): [string, string][] {

    if (!headers)
      return [];

    const result: [string, string][] = [];

    for (const key of headers.keys())
      for (const value of headers.values(key))
        result.push([key, value]);

    return result;
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
    listener: MessageHandler<T>,
    queue: string | undefined = undefined,
  ): void {
    const subj = subjectToStr(subject);
    if (!this.subscriptions[subj]) {
      this.subscriptions[subj] = this.subscribe(subj, queue);
    }
    this.ee.on(subj, listener);
  }

  public off<T>(
    subject: Subject,
    listener: MessageHandler<T>,
  ): void {
    const subj = subjectToStr(subject);
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

    await this.connection.publish(
      subjectToStr(subject),
      this.codec.encode(data),
      {
        headers: this.encodeHeaders(options?.headers),
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
  ): AsyncIterableIterator<BrokerResponse<R>> {
    if (!this.connection)
      throw new Error('Not connected');

    const timeout = options?.timeout ?? 30000;

    try {
      const responses = await this.connection.requestMany(
        subjectToStr(subject),
        this.codec.encode(data),
        {
          headers: this.encodeHeaders(options?.headers),
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
        yield {
          data: this.codec.decode(result.value.data) as R,
          headers: this.decodeHeaders(result.value.headers),
          subject: result.value.subject,
        };
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
  ): Promise<BrokerResponse<R>> {
    if (!this.connection)
      throw new Error('Not connected');

    const timeout = options?.timeout ?? 30000;

    const res = await this.connection.request(
      subjectToStr(subject),
      this.codec.encode(data),
      {
        headers: this.encodeHeaders(options?.headers),
        noMux: true,
        reply: `_INBOX.${randomId()}`,
        timeout,
      },
    );

    const headers = this.decodeHeaders(res.headers);
    const error = errorFromHeaders(headers);
    if (error)
      throw error;

    return {
      data: this.codec.decode(res.data) as R,
      headers,
      subject: res.subject,
    };
  }
}
