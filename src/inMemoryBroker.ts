import { Broker } from './broker.js';
import { debug } from './debug.js';
import { eventBucket } from './eventBucket.js';
import { TokenEventEmitter } from './tokenEventEmitter.js';
import {
  MessageHandler, Subject, BrokerResponse,
  MessageMaybeReplyTo, RequestManyOptions, RequestOptions, SendOptions,
} from './types/broker.js';
import { errorFromHeaders, addThreadContextHeaders, subjectToString } from './utils/index.js';

export class InMemoryBroker implements Broker {

  private static nextClientId = 0;

  private readonly ee = new TokenEventEmitter();

  public readonly clientId: number;

  public readonly name = 'test';

  constructor() {
    this.clientId = InMemoryBroker.nextClientId++;
  }

  createInbox(): string {
    return `_INBOX.${Math.floor(Math.random() * 1e10)}`;
  }

  public on<T>(
    subject: Subject,
    listener: MessageHandler<T>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    queue?: string,
  ): void {
    this.ee.on(subjectToString(subject), listener);
  }

  public off<T>(
    subject: Subject,
    listener: MessageHandler<T>,
  ): void {
    this.ee.off(subjectToString(subject), listener);
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
      subjectToString(subject),
      {
        data,
        headers: addThreadContextHeaders(options?.headers),
        replyTo: options?.replyTo,
      },
    );
  }

  public async* requestMany<T, R>(
    subject: Subject,
    data: T,
    options?: RequestManyOptions,
  ): AsyncIterableIterator<BrokerResponse<R>> {
    const inbox = this.createInbox();

    debug.broker.debug(`Requesting ${JSON.stringify(data)} from ${JSON.stringify(subject)}, reply to ${JSON.stringify(inbox)}`);

    const bucket = eventBucket<MessageMaybeReplyTo<R>>();

    let responseCount = 0;
    const responseLimit = options?.limit ?? -1;

    const responseHandler = (msg: MessageMaybeReplyTo<R>) => {
      bucket.push(msg);
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

    this.send(subject, data, {
      replyTo: inbox,
      headers: addThreadContextHeaders(options?.headers),
    });

    for await (const item of bucket) {
      if ('done' in item)
        break;
      else {
        const error = item.value.headers
          ? errorFromHeaders(Array.from(item.value.headers))
          : undefined;
        if (error)
          yield Promise.resolve({
            subject: inbox,
            headers: item.value.headers,
            error,
          } as BrokerResponse<R>);
        else
          yield Promise.resolve({
            subject: inbox,
            data: item.value.data,
            headers: item.value.headers,
          } as BrokerResponse<R>);
      }
    }
  }

  public async request<T, R>(
    subject: Subject,
    data: T,
    options?: RequestOptions,
  ): Promise<BrokerResponse<R | undefined>> {
    const results = this.requestMany<T, R>(
      subject,
      data,
      {
        headers: options?.headers,
        timeout: options?.timeout,
        limit: 1,
      },
    );

    const result = await results.next();
    if (!result.done) {
      if (result.value.error)
        throw result.value.error;
      return result.value;
    }

    return {
      data: undefined,
      subject: '',
    };
  }
}
