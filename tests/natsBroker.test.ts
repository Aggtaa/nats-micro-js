/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect } from 'chai';
import esmock from 'esmock';
import EventEmitter from 'events';
import * as nats from 'nats';
import sinon from 'sinon';

import { NatsBroker } from '../src/natsBroker.js';
import { MessageHandler } from '../src/types/broker.js';

let ee: InstanceType<typeof EventEmitter>;

const natsSubscriptions = {
  add: (event: string, listener: (data: nats.Payload) => void) : void => {
    ee.on(event, listener);
  },

  remove: (event: string, listener: (data: nats.Payload) => void): void => {
    ee.off(event, listener);
  },

  emit: (event: string, data: nats.Payload) : void => {
    ee.emit(event, data);
  },

  count: (event: string): number => ee.listeners(event).length,
};

const JSONCodec: () => nats.Codec<unknown> = () => ({
  encode: (data: unknown): Uint8Array => {
    const jsonString = JSON.stringify(data);
    return new TextEncoder().encode(jsonString);
  },

  decode: (uint8Array : Uint8Array): unknown => {
    const jsonString = new TextDecoder().decode(uint8Array);
    return JSON.parse(jsonString);
  },
});

const subscribe = sinon.stub<
  Parameters<nats.NatsConnection['subscribe']>,
  ReturnType<nats.NatsConnection['subscribe']>
  >().callsFake((
    subject: string,
    options?: nats.SubscriptionOptions,
  ) => {
    const callback = options?.callback;

    if (callback) {
      const listener = (data: nats.Payload): void => callback(null, {
        subject,
        data: data instanceof Uint8Array ? data : new TextEncoder().encode(data),
        sid: Math.random(),
        string: sinon.stub(),
        respond: sinon.stub(),
        json: sinon.stub(),
      });

      natsSubscriptions.add(subject, listener);

      const subscription: Partial<nats.Subscription> = {
        unsubscribe: () => natsSubscriptions.remove(subject, listener),
        getSubject: () => subject,
      };

      return subscription;
    }

    return {
      unsubscribe: sinon.stub(),
      getSubject: () => subject,
    } as any;
  });

const publish = sinon.stub<
  Parameters<nats.NatsConnection['publish']>,
  ReturnType<nats.NatsConnection['publish']>
  >().callsFake((
    subject: string,
    data: nats.Payload | undefined,
  ) => {

    if (data)
      natsSubscriptions.emit(subject, data);
  });

const connect = sinon.stub<
  Parameters<typeof nats['connect']>,
  ReturnType<typeof nats['connect']>
  >().callsFake(async () => {

    const connection: Partial<nats.NatsConnection> = {
      close: sinon.stub(),
      closed: sinon.stub(),
      subscribe,
      publish,
    };

    return connection as any;
  });

describe('NatsBroker', function () {

  let natsBroker: NatsBroker;
  let stubModule: { NatsBroker: typeof NatsBroker };

  before(async function () {
    stubModule = await esmock('../src/natsBroker.js', {
      nats: {
        JSONCodec,
        connect,
      },
    });
  });

  beforeEach(async function () {
    ee = new EventEmitter();
    natsBroker = new stubModule.NatsBroker({ name: 'TestBroker' });
    await natsBroker.connect();
  });

  afterEach(async function () {
    await natsBroker.disconnect();
  });

  describe('on', function () {

    it('expect to call subscribed handler once when receiving a message to its subject', async function () {
      const data = { key: 'value' };

      const handler1 = sinon.stub() as MessageHandler<typeof data>;

      natsBroker.on('subject', handler1);

      await natsBroker.send('subject', data);

      expect(handler1).to.be.calledOnce;
    });

    it('expect to not call subscribed handler when receiving a message to another subject', async function () {
      const data = { key: 'value' };

      const handler1 = sinon.stub() as MessageHandler<typeof data>;

      natsBroker.on('subject', handler1);

      await natsBroker.send('subject2', data);

      expect(handler1).not.to.be.called;
    });

    it('expect to call all subscribed handlers once when receiving a message to their subject', async function () {
      const data = { key: 'value' };

      const handler1 = sinon.stub() as MessageHandler<typeof data>;
      const handler2 = sinon.stub() as MessageHandler<typeof data>;

      natsBroker.on('subject', handler1);
      natsBroker.on('subject', handler2);

      await natsBroker.send('subject', data);

      expect(handler1).to.be.calledOnce;
      expect(handler2).to.be.calledOnce;
    });

    it('expect to call all subscribed handlers twice when receiving two messages to their subject', async function () {
      const data = { key: 'value' };

      const handler1 = sinon.stub() as MessageHandler<typeof data>;
      const handler2 = sinon.stub() as MessageHandler<typeof data>;

      natsBroker.on('subject', handler1);
      natsBroker.on('subject', handler2);

      await natsBroker.send('subject', data);
      await natsBroker.send('subject', data);

      expect(handler1).to.be.calledTwice;
      expect(handler2).to.be.calledTwice;
    });

    it('expect nats to be subscribed to a subject once if a handler subscribed to that subject', async function () {
      const data = { key: 'value' };

      const handler1 = sinon.stub() as MessageHandler<typeof data>;

      natsBroker.on('subject', handler1);

      expect(natsSubscriptions.count('subject')).to.equal(1);
    });

    it('expect nats to be subscribed to a subject once if multiple handlers subscribed to that subject', async function () {
      const data = { key: 'value' };

      const handler1 = sinon.stub() as MessageHandler<typeof data>;
      const handler2 = sinon.stub() as MessageHandler<typeof data>;

      natsBroker.on('subject', handler1);
      natsBroker.on('subject', handler2);

      expect(natsSubscriptions.count('subject')).to.equal(1);
    });
  });

  describe('off', function () {
    it('expect to not call unsubscribed handler when receiving message to its subject', async function () {
      const data = { key: 'value' };

      const handler1 = sinon.stub() as MessageHandler<typeof data>;

      natsBroker.on('subject', handler1);
      natsBroker.off('subject', handler1);

      await natsBroker.send('subject', data);

      expect(handler1).not.to.be.called;
    });

    it('expect to not call any unsubscribed handlers when receiving message to their subject', async function () {
      const data = { key: 'value' };

      const handler1 = sinon.stub() as MessageHandler<typeof data>;
      const handler2 = sinon.stub() as MessageHandler<typeof data>;

      natsBroker.on('subject', handler1);
      natsBroker.on('subject', handler2);

      natsBroker.off('subject', handler1);
      natsBroker.off('subject', handler2);

      await natsBroker.send('subject', data);

      expect(handler1).not.to.be.called;
      expect(handler2).not.to.be.called;
    });

    it('expect to still call subscribed handler when receiving message to its subject if another handler unsubscribed', async function () {
      const data = { key: 'value' };

      const handler1 = sinon.stub() as MessageHandler<typeof data>;
      const handler2 = sinon.stub() as MessageHandler<typeof data>;

      natsBroker.on('subject', handler1);
      natsBroker.on('subject', handler2);

      natsBroker.off('subject', handler2);

      await natsBroker.send('subject', data);

      expect(handler1).to.be.calledOnce;
    });

    it('expect nats to still be subscribed to a subject once if some handlers unsubscribed from that subject', async function () {
      const data = { key: 'value' };

      const handler1 = sinon.stub() as MessageHandler<typeof data>;
      const handler2 = sinon.stub() as MessageHandler<typeof data>;

      natsBroker.on('subject', handler1);
      natsBroker.on('subject', handler2);

      natsBroker.off('subject', handler2);

      expect(natsSubscriptions.count('subject')).to.equal(1);
    });

    it('expect nats not to be subscribed to a subject if all handlers unsubscribed from that subject', async function () {
      const data = { key: 'value' };

      const handler1 = sinon.stub() as MessageHandler<typeof data>;
      const handler2 = sinon.stub() as MessageHandler<typeof data>;

      natsBroker.on('subject', handler1);
      natsBroker.on('subject', handler2);

      natsBroker.off('subject', handler1);
      natsBroker.off('subject', handler2);

      expect(natsSubscriptions.count('subject')).to.equal(0);
    });
  });

});
