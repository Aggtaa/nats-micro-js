export class StatusError extends Error {
  constructor(
    public readonly status: string,
    message?: string,
  ) {
    super(message);
  }
}
