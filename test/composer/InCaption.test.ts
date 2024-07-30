import {DefaultRawTest, ExcerptSuite} from './abstract-suite';
import {inCaption} from './samples';

const suite = new ExcerptSuite(inCaption as DefaultRawTest[], {
  prefixInput: '<!DOCTYPE html>',
  prefixOutput: '<!DOCTYPE html><html><head></head><body>',
  suffixOutput: '</body></html>'
});

beforeAll(() => suite.beforeAll());
beforeEach(() => suite.beforeEach());
describe('In caption mode', () => suite.createSuite());
