/* eslint-disable no-throw-literal */
/* eslint-disable arrow-body-style */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { expect } from 'chai';
import Sinon from 'sinon';

import {
  Microservice, MicroserviceConfig, MicroserviceMethodConfig, MicroserviceOptions,
} from '../src/index.js';
import { InMemoryBroker } from '../src/inMemoryBroker.js';
import { StatusError } from '../src/statusError.js';

const broker = new InMemoryBroker();
const spyOn = Sinon.spy(broker, 'on');
const spyOff = Sinon.spy(broker, 'off');

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

const createServiceWithMethod = (
  data?: Partial<MicroserviceMethodConfig<unknown, unknown>>,
): Promise<Microservice> => createService({
  methods: {
    method1: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      handler: (_req, res) => {
        res.send(1);
      },
      ...data,
    },
  },
});

describe('Error handling', function () {

  afterEach(function () {
    broker.offAll();
    spyOn.resetHistory();
    spyOff.resetHistory();
  });

  it('method with no error', async function () {

    await createServiceWithMethod({
      handler: (_req, res) => {
        res.send('no error');
      },
    });

    await expect(
      broker.request<string, string>('hello.method1', ''),
    ).to.eventually.have.property('data', 'no error');
  });

  it('method with Error()', async function () {

    await createServiceWithMethod({
      handler: () => {
        throw new Error('error as usual');
      },
    });

    await expect(
      broker.request<string, string>('hello.method1', ''),
    ).to.be.eventually.rejectedWith('error as usual');
  });

  it('method with non-object error', async function () {

    await createServiceWithMethod({
      handler: () => {
        throw 'string error';
      },
    });

    await expect(
      broker.request<string, string>('hello.method1', ''),
    ).to.be.eventually.rejectedWith('string error');
  });

  it('method with StatusError()', async function () {

    await createServiceWithMethod({
      handler: () => {
        throw new StatusError(401, 'string error');
      },
    });

    await expect(
      broker.request<string, string>('hello.method1', ''),
    )
      .to.be.eventually.rejectedWith('string error')
      .and.have.property('status', '401');
  });
});
