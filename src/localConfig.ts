export const localConfig = {
  version: '0.0.3',
  nats: {
    serverUrl: process.env.NATS_URI || 'nats://localhost:4222',
  },
};
