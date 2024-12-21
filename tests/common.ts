import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import chaiLike from 'chai-like';
import chaiSubset from 'chai-subset';
import chaiThings from 'chai-things';
import Sinon from 'sinon';
import sinonChai from 'sinon-chai';

import { InMemoryBroker } from '../src/inMemoryBroker.js';

chai.use(chaiAsPromised);
chai.use(chaiSubset);

chai.use(chaiLike);
chai.use(chaiThings); // Don't swap these two

chai.use(sinonChai);

export const sleep =
  (ms: number) => new Promise((res) => {
    setTimeout(res, ms);
  });

export const broker = new InMemoryBroker();
export const spyOn = Sinon.spy(broker, 'on');
export const spyOff = Sinon.spy(broker, 'off');
