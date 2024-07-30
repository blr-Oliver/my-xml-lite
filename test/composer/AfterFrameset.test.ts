import {DefaultRawTest, DefaultSuite} from './abstract-suite';
import {afterFrameset} from './samples';

const suite = new DefaultSuite(afterFrameset as DefaultRawTest[]);

beforeAll(() => suite.beforeAll());
beforeEach(() => suite.beforeEach());
describe('After frameset mode', () => suite.createSuite());
