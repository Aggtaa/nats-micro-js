import { expect } from 'chai';

import { StatusError } from '../src/statusError.js';
import { errorToString, subjectToString } from '../src/utils/index.js';

describe('Utils', function () {

  describe('error formatting', function () {

    it('string', async function () {
      expect(
        errorToString('hello'),
      ).to.eq('hello');
    });

    it('Error', async function () {
      expect(
        errorToString(new Error('hello')),
      ).to.eq('hello');
    });

    it('object', async function () {
      expect(
        errorToString({ a: 'hello' }),
      ).to.eq('{"a":"hello"}');
    });
  });

  describe('subject formatting', function () {

    it('string', async function () {
      expect(
        subjectToString('hello'),
      ).to.eq('hello');
    });

    it('microservice.method', async function () {
      expect(
        subjectToString({ microservice: 'ms', method: 'method' }),
      ).to.eq('ms.method');
    });

    it('microservice.instance.method', async function () {
      expect(
        subjectToString({ microservice: 'ms', method: 'method', instance: '123' }),
      ).to.eq('ms.123.method');
    });

    it('invalid format', async function () {
      expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        () => subjectToString(123 as any),
      ).to.throw();
    });
  });
});
