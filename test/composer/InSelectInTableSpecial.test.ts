import {DefaultRawTest, ExcerptSuite} from './abstract-suite';
import {inSelectInTableSpecial} from './samples';

const suite = new ExcerptSuite(inSelectInTableSpecial as DefaultRawTest[], {
  prefixInput: '<!DOCTYPE html><table>',
  suffixInput: '</table>',
  prefixOutput: '<!DOCTYPE html><html><head></head><body>',
  suffixOutput: '</body></html>'
});

beforeAll(() => suite.beforeAll());
beforeEach(() => suite.beforeEach());
describe('In select in table (table-related tags) mode', () => suite.createSuite());
