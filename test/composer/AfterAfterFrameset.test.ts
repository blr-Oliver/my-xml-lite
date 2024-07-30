import {DefaultRawTest, DefaultSuite} from './abstract-suite';
import {afterAfterFrameset} from './samples';

const suite = new DefaultSuite(afterAfterFrameset as DefaultRawTest[]);

beforeAll(() => suite.beforeAll());
beforeEach(() => suite.beforeEach());
describe('After after frameset mode', () => suite.createSuite());
