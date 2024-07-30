import {DefaultRawTest, ExcerptSuite} from './abstract-suite';
import {inTableBody} from './samples';

const suite = new ExcerptSuite(inTableBody as DefaultRawTest[], {
  prefixInput: '<!DOCTYPE html>',
  prefixOutput: '<!DOCTYPE html><html><head></head><body>',
  suffixOutput: '</body></html>'
});

beforeAll(() => suite.beforeAll());
beforeEach(() => suite.beforeEach());
describe('In table body mode', () => suite.createSuite());
