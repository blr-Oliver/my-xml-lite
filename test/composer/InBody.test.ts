import {DefaultRawTest, ExcerptSuite} from './abstract-suite';
import {inBody} from './samples';

const suite = new ExcerptSuite(inBody as DefaultRawTest[], {
  prefixInput: '<!DOCTYPE html>',
  prefixOutput: '<!DOCTYPE html>'
});

beforeAll(() => suite.beforeAll());
beforeEach(() => suite.beforeEach());
describe('In body mode', () => suite.createSuite());