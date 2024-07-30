import {DefaultRawTest, ExcerptSuite} from './abstract-suite.js';
import {inForeignContent} from './samples/index.js';

const suite = new ExcerptSuite(inForeignContent as DefaultRawTest[], {
  prefixInput: '<!DOCTYPE html>',
  prefixOutput: '<!DOCTYPE html>'
});

beforeAll(() => suite.beforeAll());
beforeEach(() => suite.beforeEach());
describe('In foreign content', () => suite.createSuite());