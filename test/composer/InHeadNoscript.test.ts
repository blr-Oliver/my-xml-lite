import {DefaultRawTest, ExcerptSuite} from './abstract-suite.js';
import {inHeadNoscript} from './samples/index.js';

const suite = new ExcerptSuite(inHeadNoscript as DefaultRawTest[], {
  prefixInput: '<!DOCTYPE html>',
  prefixOutput: '<!DOCTYPE html>'
});

beforeAll(() => suite.beforeAll());
beforeEach(() => suite.beforeEach());
describe('In head noscript mode', () => suite.createSuite());
