import { EventEmitter } from 'events';
import * as nats from 'nats';

import { debug } from './debug';
import { localConfig } from './localConfig';
import {
  ExecOptions, MessageMaybeReplyTo, MethodSubject, SendOptions,
  Sender, Subject,
} from './types';
import { randomId } from './utils';

export class Broker implements Sender {

  private readonly ee = new EventEmitter();
  private connection: nats.NatsConnection;
  private connectionClosedWaiter: Promise<void | Error>;
  // eslint-disable-next-line new-cap
  private readonly codec = nats.JSONCodec();

  // eslint-disable-next-line no-useless-constructor, no-empty-function
  constructor(public readonly name: string) {
  }

  public async connect(): Promise<this> {
    debug.broker.info(`Connecting to server at ${localConfig.nats.serverUrl}`);
    try {
    this.connection = await nats.connect({
        name: this.name,
        servers: localConfig.nats.serverUrl,
      });
      this.connectionClosedWaiter = this.connection.closed();
      debug.broker.info('Connected to server');
      return this;
    }
    catch (err) {
      debug.broker.error(`Error connecting to server: ${err.toString()}`);
      throw err;
    }
  }

  public async disconnect(): Promise<void> {
    debug.broker.info('Disconnecting from server');
    try {
      await this.connection.close();
      const err = await this.connectionClosedWaiter;
      if (err)
        throw err;
        debug.broker.info('Disconnected from server');
    }
    catch (err) {
      debug.broker.error(`Error disconnecting from server: ${err.toString()}`);
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

  private async subscribe(subject: string): Promise<void> {
    debug.broker.debug(`Subscribing to "${subject}"`);
    this.connection.subscribe(
      subject,
      {
        callback: this.handleMessageFromSubscription.bind(this),
      },
    );
  }

  public on<T>(
    subject: Subject,
    listener: (data: MessageMaybeReplyTo<T>) => void,
  ): void {
    const subj = this.subjectToStr(subject);
    this.subscribe(subj);
    this.ee.on(subj, listener);
  }

  public async send<T>(
    subject: Subject,
    data: T,
    options?: SendOptions,
  ): Promise<void> {

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

  public async exec<T, R>(
    microservice: string,
    subject: MethodSubject,
    data: T,
    options?: ExecOptions,
  ): Promise<R> {
    const res = await this.connection.request(
      this.subjectToStr(subject),
      this.codec.encode(data),
      {
        noMux: true,
        reply: `_INBOX.${microservice}.${randomId()}`,
        timeout: options?.timeout ?? 30000,
      },
    );
    return this.codec.decode(res.data) as R;
  }

  private subjectToStr(subject: Subject): string {
    if (typeof (subject) === 'string')
      return subject;

    if ('method' in subject)
      return `${subject.microservice}.${subject.method}`;

    throw new Error('Unknown subject format');
  }
}
