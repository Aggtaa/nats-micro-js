import { expect } from 'chai';

import { storage } from '../../src/decorators/storage.js';
import { microservice } from '../../src/index.js';

describe('@microservice decorator', function () {
  describe('version', function () {

    it('automatic', async function () {

      @microservice()
      class Test { }

      const config = storage.getConfig(new Test());

      expect(config).to.contain({ version: '0.0.0' });
    });

    it('manual', async function () {

      @microservice({ version: '1.2.3' })
      class Test { }

      const config = storage.getConfig(new Test());

      expect(config).to.contain({ version: '1.2.3' });
    });
  });

  describe('name', function () {

    describe('automatic', function () {
      it('simple with no suffix', async function () {

        @microservice()
        class Test { }

        const config = storage.getConfig(new Test());

        expect(config).to.contain({ name: 'test' });
      });

      it('"microservice" suffix', async function () {

        @microservice()
        class TestMicroservice { }

        const config = storage.getConfig(new TestMicroservice());

        expect(config).to.contain({ name: 'test' });
      });

      it('double "microservice" suffix', async function () {

        @microservice()
        class TestMicroserviceMicroservice { }

        const config = storage.getConfig(new TestMicroserviceMicroservice());

        expect(config).to.contain({ name: 'test-microservice' });
      });

      it('camel-case with no suffix', async function () {

        @microservice()
        class SuperHelper { }

        const config = storage.getConfig(new SuperHelper());

        expect(config).to.contain({ name: 'super-helper' });
      });
    });

    it('manual', async function () {

      @microservice({ name: 'name' })
      class Test { }

      const config = storage.getConfig(new Test());

      expect(config).to.contain({ name: 'name' });
    });
  });

  describe('description', function () {

    it('automatic', async function () {

      @microservice()
      class Test { }

      const config = storage.getConfig(new Test());

      expect(config).to.contain({ description: '' });
    });

    it('description', async function () {

      @microservice({ description: 'no description' })
      class Test { }

      const config = storage.getConfig(new Test());

      expect(config).to.contain({ description: 'no description' });
    });
  });

  describe('metadata', function () {

    it('automatic', async function () {

      @microservice()
      class Test { }

      const config = storage.getConfig(new Test());

      expect(config?.metadata).to.eql({});
    });

    it('description', async function () {

      @microservice({ metadata: { field1: '1', field2: '2' } })
      class Test { }

      const config = storage.getConfig(new Test());

      expect(config?.metadata).to.contain({ field1: '1', field2: '2' });
    });
  });
});
