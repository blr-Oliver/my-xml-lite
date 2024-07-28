import {DefaultRawTest, ExcerptSuite} from './abstract-suite';
import {default as rawTests} from './samples/in-table-body.json';

const suite = new ExcerptSuite(rawTests as DefaultRawTest[], {
  prefixInput: '<!DOCTYPE html>',
  prefixOutput: '<!DOCTYPE html><html><head></head><body>',
  suffixOutput: '</body></html>'
});

beforeAll(() => suite.beforeAll());
beforeEach(() => suite.beforeEach());
describe('In table body mode', () => suite.createSuite());
