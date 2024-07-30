import {DefaultRawTest, DefaultSuite} from './abstract-suite.js';
import {afterAfterBody} from './samples/index.js';

const suite = new DefaultSuite(afterAfterBody as DefaultRawTest[]);

beforeAll(() => suite.beforeAll());
beforeEach(() => suite.beforeEach());
describe('After after body mode', () => suite.createSuite());
