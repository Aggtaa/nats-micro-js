export const localConfig = {
  version: '0.6.0',
  nats: {
    serverUrl: process.env.NATS_URI || 'nats://localhost:4222',
  },
};
