import {DefaultRawTest, DefaultSuite} from './abstract-suite.js';
import {inFrameset} from './samples/index.js';

const suite = new DefaultSuite(inFrameset as DefaultRawTest[]);

beforeAll(() => suite.beforeAll());
beforeEach(() => suite.beforeEach());
describe('In frameset mode', () => suite.createSuite());
