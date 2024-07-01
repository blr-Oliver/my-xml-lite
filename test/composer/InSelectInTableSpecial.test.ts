import {DefaultRawTest, ExcerptSuite} from './abstract-suite';
import {default as rawTests} from './samples/in-select-in-table-special.json';

const suite = new ExcerptSuite(rawTests as DefaultRawTest[], {
  prefixInput: '<table>',
  suffixInput: '</table>',
  prefixOutput: '<html><head></head><body>',
  suffixOutput: '</body></html>',
  prefixErrors: ['missing-doctype']
});

beforeAll(() => suite.beforeAll());
beforeEach(() => suite.beforeEach());
describe('In select in table (table-related tags) mode', () => suite.createSuite());
