import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import chaiSubset from 'chai-subset';
import Sinon from 'sinon';

import { InMemoryBroker } from '../src/inMemoryBroker.js';

chai.use(chaiAsPromised);
chai.use(chaiSubset);

export const sleep =
  (ms: number) => new Promise((res) => {
    setTimeout(res, ms);
  });

export const broker = new InMemoryBroker();
export const spyOn = Sinon.spy(broker, 'on');
export const spyOff = Sinon.spy(broker, 'off');
