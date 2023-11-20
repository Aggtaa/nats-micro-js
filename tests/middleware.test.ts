/* eslint-disable no-throw-literal */
/* eslint-disable arrow-body-style */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { expect } from 'chai';
import sinon, { SinonSpy } from 'sinon';

import { broker, spyOff, spyOn } from './common.js';
import {
  Handler,
  Microservice, MicroserviceConfig, MicroserviceOptions, Middleware,
  Request, Response,
} from '../src/index.js';

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

async function createServiceWithMiddlewareExt(
  middlewares: Middleware<unknown, unknown>[],
  handler: Handler<unknown, unknown> | undefined,
  postMiddlewares: Middleware<unknown, unknown>[],
): Promise<SinonSpy<[Request<unknown>, Response<unknown>], void>> {

  if (!handler)
    handler = (_req, res) => {
      res.send('method response');
    };

  const spy = sinon.spy(handler);

  await createService({
    methods: {
      method1: {
        handler: spy,
        middlewares,
        postMiddlewares,
      },
    },
  });

  return spy;
}

async function createServiceWithMiddleware(
  ...middlewares: Middleware<unknown, unknown>[]
): Promise<SinonSpy<[Request<unknown>, Response<unknown>], void>> {
  return createServiceWithMiddlewareExt(
    middlewares,
    undefined,
    [],
  );
}

describe('Middleware', function () {

  afterEach(function () {
    broker.offAll();
    spyOn.resetHistory();
    spyOff.resetHistory();
  });

  describe('Pre-middleware', function () {

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

  describe('Post-middleware', function () {

    it('middleware that does nothing', async function () {

      const middleware = sinon.spy(() => {
        // nothing
      });

      await createServiceWithMiddlewareExt(
        [],
        () => undefined,
        [middleware],
      );

      await expect(
        broker.request<string, string>('hello.method1', '', { timeout: 500 }),
      ).to.eventually.have.property('data', undefined);

      expect(middleware.callCount).to.eq(1);
    });

    it('middleware that returns', async function () {

      const middleware = sinon.spy((_req, res) => {
        res.send('middleware response');
      });

      await createServiceWithMiddlewareExt(
        [],
        () => undefined,
        [middleware],
      );

      await expect(
        broker.request<string, string>('hello.method1', ''),
      ).to.eventually.have.property('data', 'middleware response');

      expect(middleware.callCount).to.eq(1);
    });

    it('first middleware that returns', async function () {

      const middleware1 = sinon.spy((_req, res) => {
        res.send('middleware1 response');
      });
      const middleware2 = sinon.spy((_req, res) => {
        res.send('middleware2 response');
      });

      await createServiceWithMiddlewareExt(
        [],
        () => undefined,
        [middleware1, middleware2],
      );

      await expect(
        broker.request<string, string>('hello.method1', ''),
      ).to.eventually.have.property('data', 'middleware1 response');

      expect(middleware1.callCount).to.eq(1);
      expect(middleware2.callCount).to.eq(1);
    });

    it('not called after handler errors out', async function () {

      const middleware = sinon.spy((_req, res) => {
        res.send('middleware response');
      });

      await createServiceWithMiddlewareExt(
        [],
        () => {
          throw new Error('handler error');
        },
        [middleware],
      );

      await expect(
        broker.request<string, string>('hello.method1', ''),
      ).to.be.eventually.rejectedWith('handler error');

      expect(middleware.callCount).to.eq(0);
    });
  });

  it('Pass-thru middleware', async function () {

    function middlewarePairGen() : [SinonSpy[], SinonSpy[]] {
      let passThruVar = 1;

      return [
        [
          sinon.spy(() => {
            expect(passThruVar).to.eq(1);
            passThruVar = 2;
          }),
        ],
        [
          sinon.spy(() => {
            expect(passThruVar).to.eq(2);
          }),
        ],
      ];
    }

    const pair = middlewarePairGen();

    await createServiceWithMiddlewareExt(
      pair[0],
      undefined,
      pair[1],
    );

    await expect(
      broker.request<string, string>('hello.method1', ''),
    ).to.eventually.have.property('data', 'method response');

    expect(pair[0][0].callCount).to.eq(1);
    expect(pair[1][0].callCount).to.eq(1);
  });
});
