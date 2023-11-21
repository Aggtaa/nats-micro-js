/* eslint-disable @typescript-eslint/no-non-null-asserted-optional-chain */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-empty-function */
import { expect } from 'chai';

import '../common.js';
import { storage } from '../../src/decorators/storage.js';
import {
  method, microservice,
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
    expect(methods!.method.postMiddlewares).to.be.undefined;
  });

  describe('Pre-middleware', function () {

    it('single middleware', async function () {

      @microservice()
      class Test {
        @middleware.pre(() => undefined)
        @method()
        public method(_req: Request<void>, res: Response<void>): void {
          res.sendNoResponse();
        }
      }

      const config = storage.getConfig(new Test());

      const methods = config?.methods;
      expect(methods!.method.middlewares).to.have.lengthOf(1);
      expect(methods!.method.postMiddlewares).to.have.lengthOf(0);
    });

    it('multiple middleware', async function () {

      @microservice()
      class MethodTest {
        @middleware.pre(() => undefined)
        @middleware.pre(() => undefined)
        @middleware.pre(() => undefined)
        @method()
        public method(_req: Request<void>, res: Response<void>): void {
          res.sendNoResponse();
        }
      }

      const config = storage.getConfig(new MethodTest());

      const methods = config?.methods;
      expect(methods!.method.middlewares).to.have.lengthOf(3);
      expect(methods!.method.postMiddlewares).to.have.lengthOf(0);
    });
  });

  describe('Post-middleware', function () {

    it('single middleware', async function () {

      @microservice()
      class Test {
        @middleware.post(() => undefined)
        @method()
        public method(_req: Request<void>, res: Response<void>): void {
          res.sendNoResponse();
        }
      }

      const config = storage.getConfig(new Test());

      const methods = config?.methods;
      expect(methods!.method.middlewares).to.have.lengthOf(0);
      expect(methods!.method.postMiddlewares).to.have.lengthOf(1);
    });

    it('multiple middleware', async function () {

      @microservice()
      class MethodTest {
        @middleware.post(() => undefined)
        @middleware.post(() => undefined)
        @middleware.post(() => undefined)
        @method()
        public method(_req: Request<void>, res: Response<void>): void {
          res.sendNoResponse();
        }
      }

      const config = storage.getConfig(new MethodTest());

      const methods = config?.methods;
      expect(methods!.method.middlewares).to.have.lengthOf(0);
      expect(methods!.method.postMiddlewares).to.have.lengthOf(3);
    });
  });
});
