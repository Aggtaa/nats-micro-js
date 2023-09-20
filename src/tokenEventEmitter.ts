import { MessageHandler, MessageMaybeReplyTo } from './types/index.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
type EventHandler = {
  wildcard: string;
  handler: MessageHandler<unknown>;
  once: boolean;
}

export class TokenEventEmitter {

  private readonly handlers: EventHandler[] = [];

  public on<T>(wildcard: string, handler: MessageHandler<T>): void {
    this.handlers.push({ wildcard, handler: handler as MessageHandler<unknown>, once: false });
  }

  public once<T>(wildcard: string, handler: MessageHandler<T>): void {
    this.handlers.push({ wildcard, handler: handler as MessageHandler<unknown>, once: true });
  }

  public off<T>(wildcard: string, handler: MessageHandler<T>): void {
    const idx = this.handlers.findIndex((h) => h.wildcard === wildcard && h.handler === handler);

    if (idx >= 0)
      this.handlers.splice(idx, 1);
  }

  public offAll(): void {
    this.handlers.splice(0);
  }

  public emit(subject: string, msg: MessageMaybeReplyTo<unknown>): void {
    for (const handler of [...this.handlers])
      if (this.matchSubject(handler.wildcard, subject)) {
        handler.handler(msg, subject);
        if (handler.once)
          this.off(handler.wildcard, handler.handler);
      }
  }

  private matchSubject(wildcard: string, subject: string): boolean {
    if (subject === wildcard)
      return true;

    const wildcardRegexp = new RegExp(
      '^' +
      wildcard
        .replace('$', '\\$')
        .replace('.', '\\.')
        .replace('*', '[^\\.]+')
        .replace('>', '.+') +
      '$',
    );

    const match = !!subject.match(wildcardRegexp);
    return match;
  }
}
