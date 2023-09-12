type EventHandlerMethod = (args: any, subject: string) => any;

type EventHandler = {
  wildcard: string;
  handler: EventHandlerMethod;
  once: boolean;
}

export class TokenEventEmitter {

  private readonly handlers: EventHandler[] = [];

  public on(wildcard: string, handler: EventHandlerMethod): void {
    this.handlers.push({ wildcard, handler, once: false });
  }


  public once(wildcard: string, handler: EventHandlerMethod): void {
    this.handlers.push({ wildcard, handler, once: true });
  }

  public off(wildcard: string, handler: EventHandlerMethod): void {
    const idx = this.handlers.findIndex((h) => h.wildcard === wildcard && h.handler === handler);

    if (idx >= 0)
      this.handlers.splice(idx, 1);
  }

  public emit(subject: string, args: any): void {
    for (const handler of [...this.handlers])
      if (this.matchSubject(handler.wildcard, subject)) {
        handler.handler(args, subject);
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
