import { Broker } from './broker.js';
import { debug } from './debug.js';
import { eventBucket } from './eventBucket.js';
import { TokenEventEmitter } from './tokenEventEmitter.js';
import {
  MessageHandler, Subject,
  MessageMaybeReplyTo, RequestManyOptions, RequestOptions, SendOptions,
} from './types/broker.js';
import { subjectToStr } from './utils.js';

export class InMemoryBroker implements Broker {

  private readonly ee = new TokenEventEmitter();

  public readonly clientId = 0;

  createInbox(): string {
    return `_INBOX.${Math.floor(Math.random() * 1e10)}`;
  }

  public on<T>(
    subject: Subject,
    listener: MessageHandler<T>,
    queue?: string,
  ): void {
    this.ee.on(subjectToStr(subject), listener);
  }

  public off<T>(
    subject: Subject,
    listener: MessageHandler<T>,
  ): void {
    this.ee.off(subjectToStr(subject), listener);
  }

  public offAll() {
    this.ee.offAll();
  }

  public async send<T>(
    subject: Subject,
    data: T,
    options?: SendOptions,
  ): Promise<void> {
    debug.broker.debug(`Sending ${JSON.stringify(data)} to ${JSON.stringify(subject)}`);
    this.ee.emit(
      subjectToStr(subject),
      {
        data,
        headers: options?.headers,
        replyTo: options?.replyTo,
      },
    );
  }

  public async* requestMany<T, R>(
    subject: Subject,
    data: T,
    options?: RequestManyOptions,
  ): AsyncIterableIterator<R> {
    debug.broker.debug(`Requesting ${JSON.stringify(data)} from ${JSON.stringify(subject)}`);

    const bucket = eventBucket<R>();

    const inbox = this.createInbox();
    let responseCount = 0;
    const responseLimit = options?.limit ?? -1;

    const responseHandler = (msg: MessageMaybeReplyTo<R>) => {
      bucket.push(msg.data);
      if (responseLimit > 0 && (++responseCount >= responseLimit))
        // eslint-disable-next-line no-use-before-define
        close();
    };

    const close = () => {
      bucket.close();
      this.off(inbox, responseHandler);
    };

    if (options?.timeout) {
      setTimeout(close, options.timeout);
    }

    this.on(inbox, responseHandler);

    this.send(subject, data, { replyTo: inbox });

    for await (const item of bucket) {
      if ('done' in item)
        break;
      else
        yield Promise.resolve(item.value);
    }
  }

  public async request<T, R>(
    subject: Subject,
    data: T,
    options?: RequestOptions,
  ): Promise<R> {
    const results = this.requestMany<T, R>(
      subject,
      data,
      { timeout: options?.timeout, limit: 1 },
    );

    const result = await results.next();
    if (!result.done)
      return result.value;

    throw new Error('Request timed out');
  }
}
