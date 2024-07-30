import {DefaultRawTest, ExcerptSuite} from './abstract-suite.js';
import {inRow} from './samples/index.js';

const suite = new ExcerptSuite(inRow as DefaultRawTest[], {
  prefixInput: '<!DOCTYPE html>',
  prefixOutput: '<!DOCTYPE html><html><head></head><body>',
  suffixOutput: '</body></html>'
});

beforeAll(() => suite.beforeAll());
beforeEach(() => suite.beforeEach());
describe('In row mode', () => suite.createSuite());
