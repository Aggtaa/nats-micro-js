import { expect } from 'chai';
import Sinon from 'sinon';

import { sleep } from './common.js';
import {
  Microservice, MicroserviceConfig, MicroserviceOptions,
} from '../src/index.js';
import { InMemoryBroker } from '../src/inMemoryBroker.js';
import { Monitor } from '../src/monitor.js';

const broker = new InMemoryBroker();

const createService = (
  data?: Partial<MicroserviceConfig>,
  options?: MicroserviceOptions,
): Promise<Microservice> => Microservice.create(
  broker,
  {
    name: 'hello',
    description: 'Hello service',
    version: '5.5.5',
    methods: {
    },
    ...data,
  },
  options,
);

describe('Monitor', function () {

  afterEach(function () {
    broker.offAll();
  });

  describe('microservice registration', function () {

    it('"added" event', async function () {

      const monitor = new Monitor(broker);

      const spy = Sinon.spy();
      monitor.on('added', spy);

      await createService();

      expect(spy.calledOnce).to.be.true;
    });

    it('"removed" event', async function () {

      const monitor = new Monitor(broker);

      const spy = Sinon.spy();
      monitor.on('removed', spy);

      const service = await createService();
      await service.stop();

      expect(spy.calledOnce).to.be.true;
    });

    it('"change" event', async function () {

      const monitor = new Monitor(broker);

      const spy = Sinon.spy();
      monitor.on('change', spy);

      const service = await createService();

      expect(spy.calledOnce).to.be.true;
      expect(spy.firstCall.firstArg).to.containSubset([
        {
          name: 'hello',
        },
      ]);

      await service.stop();

      expect(spy.calledTwice).to.be.true;
      expect(spy.secondCall.firstArg).to.eql([]);
    });

    it('microservice re-registration', async function () {

      const monitor = new Monitor(broker);

      const changeSpy = Sinon.spy();
      const addedSpy = Sinon.spy();
      monitor.on('change', changeSpy);
      monitor.on('added', addedSpy);

      const service = await createService();
      await service.start();

      expect(addedSpy.callCount).to.eq(2);

      expect(changeSpy.callCount).to.eq(2);
      expect(changeSpy.firstCall.args).to.have.lengthOf(1);
      expect(changeSpy.secondCall.args).to.have.lengthOf(1);
    });
  });

  describe('discovery', function () {

    it('discovery from constructor', async function () {

      this.slow(2000);

      const discoverSpy = Sinon.stub(Monitor.prototype, 'discover');

      // eslint-disable-next-line no-new
      new Monitor(broker);

      await sleep(500);

      expect(discoverSpy.callCount).to.eq(1);

      discoverSpy.restore();
    });

    describe('periodic discovery', function () {
      it('start', async function () {

        this.slow(2000);

        const discoverSpy = Sinon.stub(Monitor.prototype, 'discover');

        // eslint-disable-next-line no-new
        const monitor = new Monitor(broker);
        monitor.startPeriodicDiscovery(300, 250);

        await sleep(500);

        expect(discoverSpy.callCount).to.eq(2);

        monitor.stopPeriodicDiscovery();
        discoverSpy.restore();
      });

      it('stop', async function () {

        this.slow(2000);

        const discoverSpy = Sinon.stub(Monitor.prototype, 'discover');

        // eslint-disable-next-line no-new
        const monitor = new Monitor(broker);
        monitor.startPeriodicDiscovery(300, 250);

        await sleep(500);
        monitor.stopPeriodicDiscovery();
        await sleep(500);

        expect(discoverSpy.callCount).to.eq(2);

        discoverSpy.restore();
      });
    });
  });
});
