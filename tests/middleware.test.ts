/* eslint-disable no-throw-literal */
/* eslint-disable arrow-body-style */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { expect } from 'chai';
import sinon, { SinonSpy } from 'sinon';

import { broker, spyOff, spyOn } from './common.js';
import {
  Microservice, MicroserviceConfig, MicroserviceOptions, Middleware,
} from '../src/index.js';
import { StatusError } from '../src/statusError.js';

const createService = (
  data?: Partial<MicroserviceConfig>,
  options?: MicroserviceOptions,
): Promise<Microservice> => Microservice.create(
  broker,
  {
    name: 'hello',
    description: 'Hello service',
    version: '5.5.5',
    metadata: {
      key1: 'value1',
    },
    methods: {
    },
    ...data,
  },
  options,
);

async function createServiceWithMiddleware(
  ...middlewares: Middleware<unknown, unknown>[]
): Promise<SinonSpy<[unknown, unknown], void>> {
  const handler = sinon.spy(
    (_req, res) => {
      res.send('method response');
    },
  );

  await createService({
    methods: {
      method1: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        handler,
        middlewares,
      },
    },
  });

  return handler;
}

describe('Middleware', function () {

  afterEach(function () {
    broker.offAll();
    spyOn.resetHistory();
    spyOff.resetHistory();
  });

  it('middleware that does nothing', async function () {

    const middleware = sinon.spy(() => {
      // res.send()
    });

    const handler = await createServiceWithMiddleware(
      middleware,
    );

    await expect(
      broker.request<string, string>('hello.method1', ''),
    ).to.eventually.have.property('data', 'method response');

    expect(middleware.callCount).to.eq(1);
    expect(handler.callCount).to.eq(1);
  });

  it('same multiple registered multiple times', async function () {

    const middleware = sinon.spy(() => {
      // res.send()
    });

    const handler = await createServiceWithMiddleware(
      middleware,
      middleware,
      middleware,
    );

    await expect(
      broker.request<string, string>('hello.method1', ''),
    ).to.eventually.have.property('data', 'method response');

    expect(middleware.callCount).to.eq(3);
    expect(handler.callCount).to.eq(1);
  });

  it('middleware that responds', async function () {

    const middleware = sinon.spy((_req, res) => {
      res.send('middleware response');
    });

    const handler = await createServiceWithMiddleware(
      middleware,
    );

    await expect(
      broker.request<string, string>('hello.method1', ''),
    ).to.eventually.have.property('data', 'middleware response');

    expect(middleware.callCount).to.eq(1);
    expect(handler.callCount).to.eq(0);
  });

  it('first middleware that responds', async function () {

    const middleware1 = sinon.spy((_req, res) => {
      res.send('middleware1 response');
    });

    const middleware2 = sinon.spy((_req, res) => {
      res.send('middleware2 response');
    });

    const handler = await createServiceWithMiddleware(
      middleware1,
      middleware2,
    );

    await expect(
      broker.request<string, string>('hello.method1', ''),
    ).to.eventually.have.property('data', 'middleware1 response');

    expect(middleware1.callCount).to.eq(1);
    expect(middleware2.callCount).to.eq(1);
    expect(handler.callCount).to.eq(0);
  });

  it('middleware that throws', async function () {

    const middleware = sinon.spy(() => {
      throw new Error('middleware error');
    });

    const handler = await createServiceWithMiddleware(
      middleware,
    );

    await expect(
      broker.request<string, string>('hello.method1', ''),
    ).to.eventually.be.rejectedWith('middleware error');

    expect(middleware.callCount).to.eq(1);
    expect(handler.callCount).to.eq(0);
  });
});
