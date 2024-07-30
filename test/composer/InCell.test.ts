import {DefaultRawTest, ExcerptSuite} from './abstract-suite.js';
import {inCell} from './samples/index.js';

const suite = new ExcerptSuite(inCell as DefaultRawTest[], {
  prefixInput: '<!DOCTYPE html>',
  prefixOutput: '<!DOCTYPE html><html><head></head><body>',
  suffixOutput: '</body></html>'
});

beforeAll(() => suite.beforeAll());
beforeEach(() => suite.beforeEach());
describe('In cell mode', () => suite.createSuite());
