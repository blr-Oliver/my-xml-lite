import {DefaultRawTest, DefaultSuite} from './abstract-suite';
import {inFrameset} from './samples';

const suite = new DefaultSuite(inFrameset as DefaultRawTest[]);

beforeAll(() => suite.beforeAll());
beforeEach(() => suite.beforeEach());
describe('In frameset mode', () => suite.createSuite());
