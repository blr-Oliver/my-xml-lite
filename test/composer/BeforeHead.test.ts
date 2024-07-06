import {DefaultRawTest, DefaultSuite} from './abstract-suite';
import {default as rawTests} from './samples/before-head.json';

const suite = new DefaultSuite(rawTests as DefaultRawTest[]);

beforeAll(() => suite.beforeAll());
beforeEach(() => suite.beforeEach());
describe('Before head mode', () => suite.createSuite());
