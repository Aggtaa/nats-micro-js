import { expect } from 'chai';
import Sinon from 'sinon';

import { broker } from './common.js';
import { wrapMethod } from '../src/utils/index.js';

describe('InMemoryBroker', function () {

  this.slow(3000);

  afterEach(function () {
    broker.offAll();
  });

  it('sub+send', async function () {

    const spy = Sinon.spy();

    broker.on('hello', spy);

    expect(spy.callCount).to.eql(0);

    await broker.send('hello', 'mama');

    expect(spy.callCount).to.eq(1);
    expect(spy.firstCall.args[0]).to.contain({ data: 'mama' });
  });

  it('request', async function () {

    const handler = wrapMethod(
      broker,
      (_req, res): void => {
        res.send('papa');
      },
      { method: 'papa' },
    );

    broker.on('hello', handler);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await broker.request<string, any>(
      'hello',
      'mama',
      {
        timeout: 500,
      },
    );

    expect(response.data).to.eq('papa');
  });

  it('request many', async function () {

    const handler1 = wrapMethod(
      broker,
      (_req, res): void => {
        res.send('papa 1');
      },
      { method: 'papa 1' },
    );
    const handler2 = wrapMethod(
      broker,
      (_req, res): void => {
        res.send('papa 2');
      },
      { method: 'papa 2' },
    );

    broker.on('hello', handler1);
    broker.on('hello', handler2);

    const responses: string[] = [];
    for await (const { data: response } of await broker.requestMany<string, string>(
      'hello',
      'mama',
      {
        timeout: 500,
      },
    )) {
      responses.push(response);
    }

    expect(responses).to.eql(['papa 1', 'papa 2']);
  });

  it('request many with limit', async function () {

    const handler1 = wrapMethod(
      broker,
      (_req, res): void => {
        res.send('papa 1');
      },
      { method: 'papa 1' },
    );
    const handler2 = wrapMethod(
      broker,
      (_req, res): void => {
        res.send('papa 2');
      },
      { method: 'papa 2' },
    );

    broker.on('hello', handler1);
    broker.on('hello', handler2);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const responses: any[] = [];
    for await (const { data: response } of await broker.requestMany<string, string>(
      'hello',
      'mama',
      {
        timeout: 500,
        limit: 1,
      },
    )) {
      responses.push(response);
    }

    expect(responses).to.eql(['papa 1']);
  });

});
