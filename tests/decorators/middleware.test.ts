/* eslint-disable @typescript-eslint/no-non-null-asserted-optional-chain */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-empty-function */
import { expect } from 'chai';

import '../common.js';
import { storage } from '../../src/decorators/storage.js';
import {
  method, microservice, z,
  Request, Response, middleware,
} from '../../src/index.js';

describe('@middleware decorator', function () {
  it('no middleware', async function () {

    @microservice()
    class Test {
      @method()
      public method(_req: Request<void>, res: Response<void>): void {
        res.sendNoResponse();
      }
    }

    const config = storage.getConfig(new Test());

    const methods = config?.methods;
    expect(methods).to.exist;
    expect(methods).to.have.property('method');
    expect(methods!.method.middlewares).to.be.undefined;
  });

  it('single middleware', async function () {

    @microservice()
    class Test {
      @middleware(() => undefined)
      @method()
      public method(_req: Request<void>, res: Response<void>): void {
        res.sendNoResponse();
      }
    }

    const config = storage.getConfig(new Test());

    const methods = config?.methods;
    expect(methods!.method.middlewares).to.have.lengthOf(1);
  });

  it('multiple middleware', async function () {

    @microservice()
    class MethodTest {
      @middleware(() => undefined)
      @middleware(() => undefined)
      @middleware(() => undefined)
      @method()
      public method(_req: Request<void>, res: Response<void>): void {
        res.sendNoResponse();
      }
    }

    const config = storage.getConfig(new MethodTest());

    const methods = config?.methods;
    expect(methods!.method.middlewares).to.have.lengthOf(3);
  });
});
