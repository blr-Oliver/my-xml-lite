import {DefaultRawTest, ExcerptSuite} from './abstract-suite.js';
import {inTable} from './samples/index.js';

const suite = new ExcerptSuite(inTable as DefaultRawTest[], {
  prefixInput: '<!DOCTYPE html>',
  prefixOutput: '<!DOCTYPE html><html><head></head><body>',
  suffixOutput: '</body></html>'
});

beforeAll(() => suite.beforeAll());
beforeEach(() => suite.beforeEach());
describe('In table mode', () => suite.createSuite());
