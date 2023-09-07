// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import pjson from '../package.json';

export const localConfig = {
  version: pjson.version,
  nats: {
    serverUrl: process.env.NATS_URI || 'nats://localhost:4222',
  },
};
