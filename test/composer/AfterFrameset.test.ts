import {DefaultRawTest, DefaultSuite} from './abstract-suite.js';
import {afterFrameset} from './samples/index.js';

const suite = new DefaultSuite(afterFrameset as DefaultRawTest[]);

beforeAll(() => suite.beforeAll());
beforeEach(() => suite.beforeEach());
describe('After frameset mode', () => suite.createSuite());
