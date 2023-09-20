import { expect } from 'chai';
import Sinon from 'sinon';

import { InMemoryBroker } from '../src/inMemoryBroker.js';
import { wrapMethod } from '../src/utils.js';

const broker = new InMemoryBroker();

describe('InMemoryBroker', function () {

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

    const handler = wrapMethod(broker, () => 'papa', 'papa');

    broker.on('hello', handler);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await broker.request<string, any>(
      'hello',
      'mama',
      {
        timeout: 500,
      },
    );

    expect(response).to.eq('papa');
  });

  it('request many', async function () {

    const handler1 = wrapMethod(broker, () => 'papa 1', 'papa 1');
    const handler2 = wrapMethod(broker, () => 'papa 2', 'papa 2');

    broker.on('hello', handler1);
    broker.on('hello', handler2);

    const responses: string[] = [];
    for await (const response of await broker.requestMany<string, string>(
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

    const handler1 = wrapMethod(broker, () => 'papa 1', 'papa 1');
    const handler2 = wrapMethod(broker, () => 'papa 2', 'papa 2');

    broker.on('hello', handler1);
    broker.on('hello', handler2);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const responses: any[] = [];
    for await (const response of await broker.requestMany<string, string>(
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
