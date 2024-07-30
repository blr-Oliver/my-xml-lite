import {DefaultRawTest, ExcerptSuite} from './abstract-suite';
import {inTable} from './samples';

const suite = new ExcerptSuite(inTable as DefaultRawTest[], {
  prefixInput: '<!DOCTYPE html>',
  prefixOutput: '<!DOCTYPE html><html><head></head><body>',
  suffixOutput: '</body></html>'
});

beforeAll(() => suite.beforeAll());
beforeEach(() => suite.beforeEach());
describe('In table mode', () => suite.createSuite());
