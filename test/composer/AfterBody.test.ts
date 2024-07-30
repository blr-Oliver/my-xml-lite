import {DefaultRawTest, DefaultSuite} from './abstract-suite.js';
import {afterBody} from './samples/index.js';

const suite = new DefaultSuite(afterBody as DefaultRawTest[]);

beforeAll(() => suite.beforeAll());
beforeEach(() => suite.beforeEach());
describe('After body mode', () => suite.createSuite());
