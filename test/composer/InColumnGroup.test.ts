import {DefaultRawTest, ExcerptSuite} from './abstract-suite.js';
import {inColumnGroup} from './samples/index.js';

const suite = new ExcerptSuite(inColumnGroup as DefaultRawTest[], {
  prefixInput: '<!DOCTYPE html>',
  prefixOutput: '<!DOCTYPE html><html><head></head><body>',
  suffixOutput: '</body></html>'
});

beforeAll(() => suite.beforeAll());
beforeEach(() => suite.beforeEach());
describe('In column group mode', () => suite.createSuite());
