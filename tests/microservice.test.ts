/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { expect } from 'chai';
import Sinon from 'sinon';

import { broker, spyOff, spyOn } from './common.js';
import {
  microservice, method,
  Microservice, MicroserviceConfig, MicroserviceInfo, MicroserviceMethodConfig,
  MicroservicePing, MicroserviceSchema, MicroserviceStats, MicroserviceOptions,
  Request, Response, BrokerResponse,
  MessageMaybeReplyTo, MicroserviceRegistrationSubject, MicroserviceRegistration,
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

const createDynamicService = async (noStopMethod: boolean = true): Promise<{
  service: Microservice,
  methods: Record<string, MicroserviceMethodConfig<void, string>>;
}> => {
  const methods: Record<string, MicroserviceMethodConfig<void, string>> = {};
  return {
    methods,
    service: await Microservice.create(
      broker,
      () => ({
        name: 'hello',
        description: 'Hello service',
        version: '5.5.5',
        metadata: {
          key1: 'value1',
        },
        methods,
      }),
      {
        noStopMethod,
      },
    ),
  };
};

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

  describe('dynamic config', function () {

    const registrationCounter = Sinon.stub<[MessageMaybeReplyTo<MicroserviceRegistration>, string]>();

    beforeEach(function () {
      broker.on(MicroserviceRegistrationSubject, registrationCounter);
      registrationCounter.resetHistory();
    });

    afterEach(function () {
      broker.off(MicroserviceRegistrationSubject, registrationCounter);
    });

    it('initial publication', async function () {

      await createDynamicService();

      const info: BrokerResponse<MicroserviceInfo | undefined> =
        await broker.request('$SRV.INFO', '');

      expect(info.data).to.exist;
      expect(info.data).to.containSubset({
        endpoints: [],
      });
      expect(registrationCounter.callCount).to.eq(1);
      expect(registrationCounter.firstCall.firstArg.data.info.endpoints).to.be.empty;
    });

    it('subsequent publication', async function () {

      const { service, methods } = await createDynamicService();

      methods.method1 = { handler: (_, rs) => rs.send('') };
      await service.restart();

      methods.method2 = { handler: (_, rs) => rs.send('') };
      await service.restart();

      delete (methods.method1);
      delete (methods.method2);
      await service.restart();

      expect(registrationCounter.callCount).to.eq(4);

      expect(registrationCounter.getCall(0).firstArg.data.info.endpoints).to.be.empty;

      expect(registrationCounter.getCall(1).firstArg.data.info.endpoints)
        .to.be.an('array')
        .that.contains.something.like({ name: 'method1' });

      expect(registrationCounter.getCall(2).firstArg.data.info.endpoints)
        .to.be.an('array')
        .that.contains.something.like({ name: 'method1' });
      expect(registrationCounter.getCall(2).firstArg.data.info.endpoints)
        .to.contain.something.like({ name: 'method2' });

      expect(registrationCounter.getCall(3).firstArg.data.info.endpoints).to.be.empty;
    });
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
      service.on('stop', spy);

      await broker.send(`hello.${service.id}.microservice_stop`, '');

      expect(spy.calledOnce).to.be.true;
    });

    it('event unsubscription', async function () {

      const service = await createService();

      const spy = Sinon.spy();
      service.on('stop', spy);
      service.off('stop', spy);

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
