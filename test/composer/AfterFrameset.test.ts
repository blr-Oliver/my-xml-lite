import {DefaultRawTest, DefaultSuite} from './abstract-suite';
import {default as rawTests} from './samples/after-frameset.json';

const suite = new DefaultSuite(rawTests as DefaultRawTest[]);

beforeAll(() => suite.beforeAll());
beforeEach(() => suite.beforeEach());
describe('After frameset mode', () => suite.createSuite());
