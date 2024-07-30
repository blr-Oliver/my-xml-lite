import {DefaultRawTest, ExcerptSuite} from './abstract-suite.js';
import {inSelectCommon, inSelectInTd} from './samples/index.js';

const tdTests = (inSelectCommon as DefaultRawTest[]).concat(inSelectInTd as DefaultRawTest[]);
const tdSuite = new ExcerptSuite(tdTests, {
  prefixInput: '<!DOCTYPE html><table><tbody><tr><td>',
  suffixInput: '</td></tr></tbody></table>',
  prefixOutput: '<!DOCTYPE html><html><head></head><body><table><tbody><tr><td>',
  suffixOutput: '</td></tr></tbody></table></body></html>'
});

beforeAll(() => tdSuite.beforeAll());
beforeEach(() => tdSuite.beforeEach());
describe('In select in table mode (inside td)', () => tdSuite.createSuite());
