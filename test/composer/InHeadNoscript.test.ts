import {DefaultRawTest, ExcerptSuite} from './abstract-suite';
import {default as rawTests} from './samples/in-head-noscript.json';

const suite = new ExcerptSuite(rawTests as DefaultRawTest[], {
  prefixInput: '<!DOCTYPE html>',
  prefixOutput: '<!DOCTYPE html>'
});

beforeAll(() => suite.beforeAll());
beforeEach(() => suite.beforeEach());
describe('In head noscript mode', () => suite.createSuite());
