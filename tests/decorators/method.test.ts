/* eslint-disable @typescript-eslint/no-empty-function */
import { expect } from 'chai';

import '../common.js';
import { storage } from '../../src/decorators/storage.js';
import {
  method, microservice, z,
  Request, Response,
} from '../../src/index.js';

describe('@method decorator', function () {
  it('empty', async function () {

    @microservice()
    class Test {
    }

    const config = storage.getConfig(new Test());

    expect(config?.methods).to.eql({});
  });

  it('automatic', async function () {

    @microservice()
    class MethodTest {
      @method()
      public method(_req: Request<void>, res: Response<void>): void {
        res.sendNoResponse();
      }
    }

    const config = storage.getConfig(new MethodTest());

    const keys = Object.keys(config?.methods ?? {});
    expect(keys).to.eql(['method']);
  });

  describe('name', function () {

    it('automatic', async function () {

      @microservice()
      class MethodTest {
        @method()
        public method(_req: Request<void>, res: Response<void>): void {
          res.sendNoResponse();
        }
      }

      const config = storage.getConfig(new MethodTest());
      const keys = Object.keys(config?.methods ?? {});

      expect(keys).to.eql(['method']);
    });

    it('manual', async function () {

      @microservice()
      class MethodTest {
        @method({ name: 'testMethod' })
        public method(_req: Request<void>, res: Response<void>): void {
          res.sendNoResponse();
        }
      }

      const config = storage.getConfig(new MethodTest());
      const keys = Object.keys(config?.methods ?? {});

      expect(keys).to.eql(['testMethod']);
    });
  });

  describe('subject', function () {

    it('automatic', async function () {

      @microservice()
      class MethodTest {
        @method()
        public method(_req: Request<void>, res: Response<void>): void {
          res.sendNoResponse();
        }
      }

      const config = storage.getConfig(new MethodTest());

      expect(config?.methods.method).to.not.have.key('subject');
    });

    it('manual', async function () {

      @microservice()
      class MethodTest {
        @method({ subject: 'testSubject' })
        public method(_req: Request<void>, res: Response<void>): void {
          res.sendNoResponse();
        }
      }

      const config = storage.getConfig(new MethodTest());

      expect(config?.methods.method).to.have.property('subject', 'testSubject');
    });
  });

  it('handler', async function () {

    @microservice()
    class Test {
      @method({
        request: z.void(),
        response: z.void(),
      })
      public method(_req: Request<void>, res: Response<void>): void {
        res.sendNoResponse();
      }
    }

    const target = new Test();
    const config = storage.getConfig(target);

    expect(config?.methods.method.handler).to.eq(target.method);
  });
});
