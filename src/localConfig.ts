export const localConfig = {
  version: '0.7.0',
  nats: {
    serverUrl: process.env.NATS_URI || 'nats://localhost:4222',
  },
};
