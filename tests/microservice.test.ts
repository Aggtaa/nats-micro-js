/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { expect } from 'chai';
import Sinon from 'sinon';

import { broker, spyOff, spyOn } from './common.js';
import {
  microservice, method,
  Microservice, MicroserviceConfig, MicroserviceInfo, MicroserviceMethodConfig,
  MicroservicePing, MicroserviceSchema, MicroserviceStats, MicroserviceOptions,
  Request, Response, BrokerResponse,
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

describe('Microservice and Discovery', function () {

  afterEach(function () {
    broker.offAll();
    spyOn.resetHistory();
    spyOff.resetHistory();
  });

  it('subscription from config', async function () {

    const service = await createService();

    expect(spyOn.callCount).to.greaterThanOrEqual(12);

    for (const schema of ['SCHEMA', 'INFO', 'PING', 'STATS']) {
      expect(spyOn.calledWith(`$SRV.${schema}`)).to.be.true;
      expect(spyOn.calledWith(`$SRV.${schema}.${service.config.name}`)).to.be.true;
      expect(spyOn.calledWith(`$SRV.${schema}.${service.config.name}.${service.id}`)).to.be.true;
    }
  });

  it('dynamic config', async function () {

    const service = await Microservice.create(
      broker,
      () => ({
        name: 'hello',
        description: 'Hello service',
        version: '5.5.5',
        metadata: {
          key1: 'value1',
        },
        methods: {
        },
      }),
    );

    expect(service).to.exist;
  });

  it('from class', async function () {

    @microservice()
    class Test {
      @method()
      method1(_req: Request<void>, res: Response<void>): void {
        res.sendNoResponse();
      }
    }

    await Microservice.createFromClass(
      broker,
      new Test(),
    );

    expect(spyOn.callCount).to.greaterThanOrEqual(13);
    expect(spyOn.calledWith('test.method1')).to.be.true;
  });

  it('from non-decorated class', async function () {

    class Test {
      method1(_req: Request<void>, res: Response<void>): void {
        res.sendNoResponse();
      }
    }

    await expect(
      Microservice.createFromClass(
        broker,
        new Test(),
      ),
    ).to.be.rejectedWith();
  });

  it('info', async function () {

    const service = await createServiceWithMethod();

    const info: BrokerResponse<MicroserviceInfo | undefined> =
      await broker.request('$SRV.INFO', '');

    expect(info.data).to.exist;
    expect(info.data).to.containSubset({
      type: 'io.nats.micro.v1.info_response',
      name: 'hello',
      description: 'Hello service',
      id: service.id,
      version: '5.5.5',
      metadata: {
        key1: 'value1',
        'nats.micro.ext.v1.service.node': 'test',
      },
      endpoints: [
        {
          name: 'method1',
        },
      ],
    });
  });

  describe('stop method', function () {

    it('subscription', async function () {

      const service = await createService();

      expect(spyOn.calledWith(`hello.${service.id}.microservice_stop`)).to.be.true;
    });

    it('no stop method', async function () {

      const service = await createService({}, { noStopMethod: true });

      expect(spyOn.calledWith(`hello.${service.id}.microservice_stop`)).to.be.false;
    });

    it('call', async function () {

      const service = await createService();

      const info: BrokerResponse<MicroserviceInfo | undefined> =
        await broker.request('$SRV.INFO', '');

      expect(info.data).to.exist;
      expect(info.data).to.containSubset({
        endpoints: [
          {
            name: 'microservice_stop',
            metadata: {
              'nats.micro.ext.v1.feature': 'microservice_stop',
              'nats.micro.ext.v1.feature.params': JSON.stringify({ name: 'hello', id: service.id }),
              'nats.micro.ext.v1.method.local': 'true',
              'nats.micro.ext.v1.method.unbalanced': 'true',
            },
          },
        ],
      });
    });

    it('event', async function () {

      const service = await createService();

      const spy = Sinon.spy();
      service.on('close', spy);

      await broker.send(`hello.${service.id}.microservice_stop`, '');

      expect(spy.calledOnce).to.be.true;
    });

    it('event unsubscription', async function () {

      const service = await createService();

      const spy = Sinon.spy();
      service.on('close', spy);
      service.off('close', spy);

      await broker.send(`hello.${service.id}.microservice_stop`, '');

      expect(spy.calledOnce).to.be.false;
    });
  });

  it('automatic global method subject', async function () {

    await createServiceWithMethod();

    const info: BrokerResponse<MicroserviceInfo | undefined> =
      await broker.request('$SRV.INFO', '');

    expect(info.data).to.exist;
    expect(info.data!.endpoints).to.include.deep.members([{
      name: 'method1',
      subject: 'hello.method1',
      metadata: {},
    }]);
  });

  it('automatic local method subject', async function () {

    const service = await createServiceWithMethod({
      local: true,
    });

    const info: BrokerResponse<MicroserviceInfo | undefined> =
      await broker.request('$SRV.INFO', '');

    expect(info.data).to.exist;
    expect(info.data!.endpoints).to.include.deep.members([{
      name: 'method1',
      subject: `hello.${service.id}.method1`,
      metadata: {
        'nats.micro.ext.v1.method.local': 'true',
      },
    }]);
  });

  it('manual method subject', async function () {

    await createServiceWithMethod({
      subject: 'testSubject',
    });

    const info: BrokerResponse<MicroserviceInfo | undefined> =
      await broker.request('$SRV.INFO', '');

    expect(info.data).to.exist;
    expect(info.data!.endpoints).to.include.deep.members([{
      name: 'method1',
      subject: 'testSubject',
      metadata: {},
    }]);
  });

  it('unbalanced method metadata', async function () {

    await createServiceWithMethod({
      unbalanced: true,
    });

    const info: BrokerResponse<MicroserviceInfo | undefined> =
      await broker.request('$SRV.INFO', '');

    expect(info.data).to.exist;
    expect(info.data!.endpoints).to.include.deep.members([{
      name: 'method1',
      subject: 'hello.method1',
      metadata: {
        'nats.micro.ext.v1.method.unbalanced': 'true',
      },
    }]);
  });

  it('schema', async function () {

    const service = await createServiceWithMethod();

    const info: BrokerResponse<MicroserviceSchema | undefined> =
      await broker.request('$SRV.SCHEMA', '');

    expect(info.data).to.exist;
    expect(info.data).to.containSubset({
      type: 'io.nats.micro.v1.schema_response',
      name: 'hello',
      id: service.id,
      version: '5.5.5',
      metadata: {
        key1: 'value1',
      },
      endpoints: [
        {
          name: 'method1',
          schema: {
            request: {},
            response: {},
          },
        },
      ],
    });
  });

  it('ping', async function () {

    const service = await createServiceWithMethod();

    const info: BrokerResponse<MicroservicePing | undefined> =
      await broker.request('$SRV.PING', '');

    expect(info.data).to.exist;
    expect(info.data).to.containSubset({
      type: 'io.nats.micro.v1.ping_response',
      name: 'hello',
      id: service.id,
      version: '5.5.5',
      metadata: {
        key1: 'value1',
      },
    });
  });

  describe('stats', function () {

    it('empty', async function () {

      const service = await createServiceWithMethod();

      const info: BrokerResponse<MicroserviceStats | undefined> =
        await broker.request('$SRV.STATS', '');

      expect(info.data).to.exist;
      expect(info.data!.started).to.exist;
      expect(info.data).to.containSubset({
        type: 'io.nats.micro.v1.stats_response',
        name: 'hello',
        id: service.id,
        version: '5.5.5',
        metadata: {
          key1: 'value1',
        },
        endpoints: [
          {
            average_processing_time: 0,
            last_error: '',
            num_errors: 0,
            num_requests: 0,
            processing_time: 0,
          },
        ],
      });
    });

    it('after a call', async function () {

      await createServiceWithMethod();

      await broker.request('hello.method1', '');

      const info: BrokerResponse<MicroserviceStats | undefined> =
        await broker.request('$SRV.STATS', '');

      expect(info.data).to.exist;
      expect(info.data!.endpoints[0]).to.containSubset({
        last_error: '',
        num_errors: 0,
        num_requests: 1,
      });
      expect(info.data!.endpoints[0].average_processing_time).to.be.greaterThan(0);
      expect(info.data!.endpoints[0].processing_time).to.be.greaterThan(0);
    });

    it('after a call that throws an exception', async function () {

      await createServiceWithMethod({
        handler: () => {
          throw new Error('Some Error');
        },
      });

      await expect(broker.request('hello.method1', '')).to.be.rejectedWith('Some Error');

      const info: BrokerResponse<MicroserviceStats | undefined> =
        await broker.request('$SRV.STATS', '');

      expect(info.data).to.exist;
      expect(info.data!.endpoints[0]).to.containSubset({
        last_error: 'Some Error',
        num_errors: 1,
        num_requests: 1,
      });
    });
  });

  it('dynamic method add', async function () {

    const service = await createServiceWithMethod();

    await service.addMethod(
      'method2',
      {
        handler: () => 'method2',
      },
    );

    const info = await broker.request('$SRV.INFO', '');

    expect(info.data).to.exist;
    expect(info.data).to.containSubset({
      endpoints: [
        {
          name: 'method1',
        },
        {
          name: 'method2',
        },
      ],
    });
  });

  it('dynamic stop', async function () {
    this.timeout(3000);

    const service = await createServiceWithMethod();

    const ping1 = await broker.request('$SRV.PING', '');

    expect(ping1).to.exist;

    await service.stop();

    expect(spyOff.callCount).to.greaterThanOrEqual(13);
    for (const schema of ['SCHEMA', 'INFO', 'PING', 'STATS']) {
      expect(spyOff.calledWith(`$SRV.${schema}`)).to.be.true;
      expect(spyOff.calledWith(`$SRV.${schema}.${service.config.name}`)).to.be.true;
      expect(spyOff.calledWith(`$SRV.${schema}.${service.config.name}.${service.id}`)).to.be.true;
    }
    expect(spyOff.calledWith('hello.method1')).to.be.true;

    const ping2 = await broker.request('$SRV.PING', '', { timeout: 1000 });

    expect(ping2.data).to.not.exist;
  });
});
