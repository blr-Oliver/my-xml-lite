import {DefaultRawTest, ExcerptSuite} from './abstract-suite';
import {default as commonTests} from './samples/in-select-common.json';
import {default as inTableTests} from './samples/in-select-in-table.json';

const tableTests = (commonTests as DefaultRawTest[]).concat(inTableTests as DefaultRawTest[]);
const tableSuite = new ExcerptSuite(tableTests, {
  prefixInput: '<table>',
  suffixInput: '</table>',
  prefixOutput: '<html><head></head><body>',
  suffixOutput: '<table></table></body></html>',
  prefixErrors: ['missing-doctype', 'unexpected-content-in-table']
});

beforeAll(() => tableSuite.beforeAll());
beforeEach(() => tableSuite.beforeEach());
describe('In select in table mode (inside table)', () => tableSuite.createSuite());
