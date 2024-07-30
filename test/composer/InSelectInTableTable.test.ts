import {DefaultRawTest, ExcerptSuite} from './abstract-suite.js';
import {inSelectCommon, inSelectInTable} from './samples/index.js';

const tableTests = (inSelectCommon as DefaultRawTest[]).concat(inSelectInTable as DefaultRawTest[]);
const tableSuite = new ExcerptSuite(tableTests, {
  prefixInput: '<!DOCTYPE html><table>',
  suffixInput: '</table>',
  prefixOutput: '<!DOCTYPE html><html><head></head><body>',
  suffixOutput: '<table></table></body></html>',
  prefixErrors: ['unexpected-content-in-table']
});

beforeAll(() => tableSuite.beforeAll());
beforeEach(() => tableSuite.beforeEach());
describe('In select in table mode (inside table)', () => tableSuite.createSuite());
