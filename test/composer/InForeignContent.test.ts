import {DefaultRawTest, ExcerptSuite} from './abstract-suite';
import {inForeignContent} from './samples';

const suite = new ExcerptSuite(inForeignContent as DefaultRawTest[], {
  prefixInput: '<!DOCTYPE html>',
  prefixOutput: '<!DOCTYPE html>'
});

beforeAll(() => suite.beforeAll());
beforeEach(() => suite.beforeEach());
describe('In foreign content', () => suite.createSuite());