import {DefaultRawTest, DefaultSuite} from './abstract-suite.js';
import {beforeHead} from './samples/index.js';

const suite = new DefaultSuite(beforeHead as DefaultRawTest[]);

beforeAll(() => suite.beforeAll());
beforeEach(() => suite.beforeEach());
describe('Before head mode', () => suite.createSuite());
