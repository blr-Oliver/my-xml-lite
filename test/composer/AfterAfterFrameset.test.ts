import {DefaultRawTest, DefaultSuite} from './abstract-suite.js';
import {afterAfterFrameset} from './samples/index.js';

const suite = new DefaultSuite(afterAfterFrameset as DefaultRawTest[]);

beforeAll(() => suite.beforeAll());
beforeEach(() => suite.beforeEach());
describe('After after frameset mode', () => suite.createSuite());
