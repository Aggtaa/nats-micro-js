export class StatusError extends Error {
  constructor(
    public readonly status: string | number,
    message?: string,
  ) {
    super(message);
  }
}
