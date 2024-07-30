import {DefaultRawTest, ExcerptSuite} from './abstract-suite.js';
import {inBody} from './samples/index.js';

const suite = new ExcerptSuite(inBody as DefaultRawTest[], {
  prefixInput: '<!DOCTYPE html>',
  prefixOutput: '<!DOCTYPE html>'
});

beforeAll(() => suite.beforeAll());
beforeEach(() => suite.beforeEach());
describe('In body mode', () => suite.createSuite());