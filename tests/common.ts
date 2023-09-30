import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import chaiSubset from 'chai-subset';

chai.use(chaiAsPromised);
chai.use(chaiSubset);

export const sleep =
  (ms: number) => new Promise((res) => {
    setTimeout(res, ms);
  });
