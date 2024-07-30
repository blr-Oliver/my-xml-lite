import {DefaultRawTest, ExcerptSuite} from './abstract-suite';
import {inHead} from './samples';

const suite = new ExcerptSuite(inHead as DefaultRawTest[], {
  prefixInput: '<!DOCTYPE html>',
  prefixOutput: '<!DOCTYPE html>'
});

beforeAll(() => suite.beforeAll());
beforeEach(() => suite.beforeEach());
describe('In head mode', () => suite.createSuite());
