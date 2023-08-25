import { EventEmitter } from 'events';
import * as nats from 'nats';

import { localConfig } from './localConfig';
import { log } from './log';
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
    log.info(`loc[[BROKER]] Connecting to NATS at loc[[${localConfig.nats.serverUrl}]]`);
    try {
      this.connection = await nats.connect({
        name: this.name,
        servers: localConfig.nats.serverUrl,
      });
      this.connectionClosedWaiter = this.connection.closed();
      log.info('loc[[BROKER]] Connected to NATS');
      return this;
    }
    catch (err) {
      log.error(`loc[[BROKER]] Error connecting to NATS: ${err.toString()}`);
      throw err;
    }
  }

  public async disconnect(): Promise<void> {
    log.info('loc[[BROKER]] Disconnecting from NATS');
    try {
      await this.connection.close();
      const err = await this.connectionClosedWaiter;
      if (err)
        throw err;
      log.info('loc[[BROKER]] Disconnected from NATS');
    }
    catch (err) {
      log.error(`loc[[BROKER]] Error disconnecting from NATS: ${err.toString()}`);
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
      log.error(`loc[[BROKER]] Error in message on loc[[${msg.subject}]]: data[[${err}]]`);
    }
    else {
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
        log.error(`loc[[BROKER]] Error decoding message on loc[[${msg.subject}]] data[["${content}"]]`);
      }
    }
  }

  private async subscribe(subject: string): Promise<void> {
    log.debug(`loc[[BROKER]] Subscribing to data[[${subject}]]`);
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
