import nanoid from 'nanoid-esm';

export function randomId(): string {
  return nanoid(16);
}
