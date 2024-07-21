import {DefaultRawTest, ExcerptSuite} from './abstract-suite';
import {default as rawTests} from './samples/formatting.json';

const suite = new ExcerptSuite(rawTests as DefaultRawTest[], {
  prefixInput: '<!DOCTYPE html><body>',
  suffixInput: '</body>',
  prefixOutput: '<!DOCTYPE html><html><head></head><body>',
  suffixOutput: '</body></html>'
});

beforeAll(() => suite.beforeAll());
beforeEach(() => suite.beforeEach());
describe('Formatting elements', () => suite.createSuite());