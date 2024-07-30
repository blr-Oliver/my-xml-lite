import {DefaultRawTest, ExcerptSuite} from './abstract-suite.js';
import {inSelect, inSelectCommon} from './samples/index.js';

const tests = (inSelectCommon as DefaultRawTest[]).concat(inSelect as DefaultRawTest[]);
const suite = new ExcerptSuite(tests as DefaultRawTest[], {
  prefixInput: '<!DOCTYPE html>',
  prefixOutput: '<!DOCTYPE html><html><head></head><body>',
  suffixOutput: '</body></html>'
});

beforeAll(() => suite.beforeAll());
beforeEach(() => suite.beforeEach());
describe('In select mode', () => suite.createSuite());
