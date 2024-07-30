import {DefaultRawTest, ExcerptSuite} from './abstract-suite.js';
import {afterHead} from './samples/index.js';

const suite = new ExcerptSuite(afterHead as DefaultRawTest[], {
  prefixInput: '<!DOCTYPE html>',
  prefixOutput: '<!DOCTYPE html>'
});

beforeAll(() => suite.beforeAll());
beforeEach(() => suite.beforeEach());
describe('After head mode', () => suite.createSuite());
