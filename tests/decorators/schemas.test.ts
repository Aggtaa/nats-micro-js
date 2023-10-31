/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { expect } from 'chai';
import { zodToJsonSchema } from 'zod-to-json-schema';

import {
  InMemoryBroker, Microservice, method, microservice,
  z, MicroserviceSchema, BrokerResponse, Request, Response,
} from '../../src/index.js';

const testRequestSchema = z.object({
  field1: z.string().optional(),
  field2: z.number({ description: 'a number' }).min(15),
});
type TestRequest =
  z.infer<typeof testRequestSchema>;
const testRequestJsonSchema = zodToJsonSchema(testRequestSchema);

const testResponseSchema = z.object({
  success: z.boolean(),
});
type TestResponse =
  z.infer<typeof testResponseSchema>;
const testResponseJsonSchema = zodToJsonSchema(testResponseSchema);

const voidJsonSchema = zodToJsonSchema(z.void());

const broker = new InMemoryBroker();

describe('type schemas', function () {

  this.afterEach(function () {
    broker.offAll();
  });

  it('request+response typed method', async function () {

    @microservice()
    class Test {
      @method({
        request: testRequestSchema,
        response: testResponseSchema,
      })
      public test(req: Request<TestRequest>, res: Response<TestResponse>): void {
        res.send({
          success: req.data.field1 === 'user',
        });
      }
    }

    const service = await Microservice.createFromClass(broker, new Test());

    const reqSchema = service.discovery.getMethodJsonSchema('test', 'request');
    const resSchema = service.discovery.getMethodJsonSchema('test', 'response');

    expect(reqSchema).to.eql(testRequestJsonSchema);
    expect(resSchema).to.eql(testResponseJsonSchema);
  });

  it('request+response typed async method', async function () {

    @microservice()
    class Test {
      @method({
        request: testRequestSchema,
        response: testResponseSchema,
      })
      public test(req: Request<TestRequest>, res: Response<TestResponse>): void {
        res.send({
          success: req.data.field1 === 'user',
        });
      }
    }

    const service = await Microservice.createFromClass(broker, new Test());

    const reqSchema = service.discovery.getMethodJsonSchema('test', 'request');
    const resSchema = service.discovery.getMethodJsonSchema('test', 'response');

    expect(reqSchema).to.eql(testRequestJsonSchema);
    expect(resSchema).to.eql(testResponseJsonSchema);
  });

  it('request-only typed method', async function () {

    @microservice()
    class Test {
      @method({
        request: testRequestSchema,
      })
      public test(_req: Request<TestRequest>, res: Response<void>): void {
        res.end();
      }
    }

    const service = await Microservice.createFromClass(broker, new Test());

    const reqSchema = service.discovery.getMethodJsonSchema('test', 'request');
    const resSchema = service.discovery.getMethodJsonSchema('test', 'response');

    expect(reqSchema).to.eql(testRequestJsonSchema);
    expect(resSchema).to.eql(voidJsonSchema);
  });

  it('non-typed method', async function () {

    @microservice()
    class Test {
      @method()
      public test(_req: Request<void>, res: Response<void>): void {
        res.end();
      }
    }

    const service = await Microservice.createFromClass(broker, new Test());

    const reqSchema = service.discovery.getMethodJsonSchema('test', 'request');
    const resSchema = service.discovery.getMethodJsonSchema('test', 'response');

    expect(reqSchema).to.eql(voidJsonSchema);
    expect(resSchema).to.eql(voidJsonSchema);
  });

  it('getting schemas via broker', async function () {

    @microservice()
    class Test {
      @method({
        request: testRequestSchema,
        response: testResponseSchema,
      })
      public test(req: Request<TestRequest>, res: Response<TestResponse>): void {
        res.send({
          success: req.data.field1 === 'user',
        });
      }
    }

    await Microservice.createFromClass(broker, new Test());

    const data: BrokerResponse<MicroserviceSchema | undefined> = await broker.request('$SRV.SCHEMA', '');

    expect(data.data).to.exist;

    const methodSchema = data.data!.endpoints.find((ep) => ep.name === 'test');

    expect(methodSchema).to.exist;

    expect(methodSchema!.schema.request).to.eql(testRequestJsonSchema);
    expect(methodSchema!.schema.response).to.eql(testResponseJsonSchema);
  });

  describe('request validation', function () {

    it('non-json', async function () {

      @microservice()
      class Test {
        @method({
          request: testRequestSchema,
          response: testResponseSchema,
        })
        public test(req: Request<TestRequest>, res: Response<TestResponse>): void {
          res.send({
            success: req.data.field1 === 'user',
          });
        }
      }

      await Microservice.createFromClass(broker, new Test());

      await expect(broker.request('test.test', '')).to.be.rejectedWith(/request/i);
    });

    it('invalid type', async function () {

      @microservice()
      class Test {
        @method({
          request: testRequestSchema,
          response: testResponseSchema,
        })
        public test(req: Request<TestRequest>, res: Response<TestResponse>): void {
          res.send({
            success: req.data.field1 === 'user',
          });
        }
      }

      await Microservice.createFromClass(broker, new Test());

      await expect(broker.request('test.test', { name: 'no name' })).to.be.rejectedWith(/request/i);
    });
  });

  describe('response validation', function () {

    it('invalid type', async function () {

      @microservice()
      class Test {
        @method({
          request: z.void(),
          response: testResponseSchema,
        })
        public test(_req: Request<void>, res: Response<TestResponse>): void {
          res.send(
            {
              hello: 'invalid',
            } as any,
          );
        }
      }

      await Microservice.createFromClass(broker, new Test());

      await expect(broker.request('test.test', '')).to.be.rejectedWith(/response/i);
    });

    it('invalid empty response', async function () {

      @microservice()
      class Test {
        @method({
          request: z.void(),
          response: testResponseSchema,
        })
        public test(_req: Request<void>, res: Response<TestResponse>): void {
          res.send(undefined as any);
        }
      }

      await Microservice.createFromClass(broker, new Test());

      await expect(broker.request('test.test', '')).to.be.rejectedWith(/response/i);
    });

    // eslint-disable-next-line mocha/no-identical-title
    it('non-empty response', async function () {

      @microservice()
      class Test {
        @method({
          request: z.void(),
          response: z.void(),
        })
        public test(_req: Request<void>, res: Response<void>): void {
          res.send(
            {
              hello: 'invalid',
            } as any,
          );
        }
      }

      await Microservice.createFromClass(broker, new Test());

      await expect(broker.request('test.test', { name: 'no name' })).to.be.rejectedWith(/response/i);
    });
  });
});
