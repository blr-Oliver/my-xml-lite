import {DefaultRawTest, ExcerptSuite} from './abstract-suite';
import {default as commonTests} from './samples/in-select-common.json';
import {default as selectTests} from './samples/in-select.json';

const tests = (commonTests as DefaultRawTest[]).concat(selectTests as DefaultRawTest[]);
const suite = new ExcerptSuite(tests as DefaultRawTest[], {
  prefixInput: '<!DOCTYPE html>',
  prefixOutput: '<!DOCTYPE html><html><head></head><body>',
  suffixOutput: '</body></html>'
});

beforeAll(() => suite.beforeAll());
beforeEach(() => suite.beforeEach());
describe('In select mode', () => suite.createSuite());
