import {DefaultRawTest, ExcerptSuite} from './abstract-suite';
import {default as commonTests} from './samples/in-select-common.json';
import {default as inTdTests} from './samples/in-select-in-td.json';

const tdTests = (commonTests as DefaultRawTest[]).concat(inTdTests as DefaultRawTest[]);
const tdSuite = new ExcerptSuite(tdTests, {
  prefixInput: '<table><tbody><tr><td>',
  suffixInput: '</td></tr></tbody></table>',
  prefixOutput: '<html><head></head><body><table><tbody><tr><td>',
  suffixOutput: '</td></tr></tbody></table></body></html>',
  prefixErrors: ['missing-doctype']
});

beforeAll(() => tdSuite.beforeAll());
beforeEach(() => tdSuite.beforeEach());
describe('In select in table mode (inside td)', () => tdSuite.createSuite());
