export const localConfig = {
  nats: {
    serverUrl: process.env.NATS_URI || 'nats://localhost:4222',
  },
};
