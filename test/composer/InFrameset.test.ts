import {DefaultRawTest, DefaultSuite} from './abstract-suite';
import {default as rawTests} from './samples/in-frameset.json';

const suite = new DefaultSuite(rawTests as DefaultRawTest[]);

beforeAll(() => suite.beforeAll());
beforeEach(() => suite.beforeEach());
describe('In frameset mode', () => suite.createSuite());
