import {DefaultRawTest, ExcerptSuite} from './abstract-suite';
import {formatting} from './samples';

const suite = new ExcerptSuite(formatting as DefaultRawTest[], {
  prefixInput: '<!DOCTYPE html><body>',
  suffixInput: '</body>',
  prefixOutput: '<!DOCTYPE html><html><head></head><body>',
  suffixOutput: '</body></html>'
});

beforeAll(() => suite.beforeAll());
beforeEach(() => suite.beforeEach());
describe('Formatting elements', () => suite.createSuite());