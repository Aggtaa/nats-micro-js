/* eslint-disable @typescript-eslint/no-empty-function */
import { expect } from 'chai';
import Sinon from 'sinon';

import {
  method, microservice, z,
  Request, Response, Microservice,
} from '../../src/index.js';
import { broker } from '../common.js';

describe('multiple createFromClass', function () {

  it('should have different ids', async function () {

    @microservice()
    class Test { }

    const ms1 = await Microservice.createFromClass(
      broker,
      new Test(),
    );

    const ms2 = await Microservice.createFromClass(
      broker,
      new Test(),
    );

    expect(ms1.discovery.id).not.to.eq(ms2.discovery.id);
  });

  it('should class instance methods', async function () {

    const counter1 = Sinon.stub<[string]>();
    const counter2 = Sinon.stub<[string]>();

    @microservice()
    class Test {
      private __microservice: Microservice | undefined;

      constructor(private readonly counter: Sinon.SinonStub) {
      }

      @method({
        request: z.void(),
        response: z.string(),
      })
      method1(_req: Request<void>, res: Response<string>): void {
        this.counter.call(this.counter, this.__microservice?.id ?? 'undefined');
        res.send(this.__microservice?.id ?? 'undefined');
      }
    }

    const ms1 = await Microservice.createFromClass(
      broker,
      new Test(counter1),
    );

    const ms2 = await Microservice.createFromClass(
      broker,
      new Test(counter2),
    );

    await broker.request('test.method1', '{}');

    expect(counter1.callCount).to.eq(1);
    expect(counter1.calledOnceWithExactly(ms1.id)).to.be.true;
    expect(counter2.callCount).to.eq(1);
    expect(counter2.calledOnceWithExactly(ms2.id)).to.be.true;
  });
});
