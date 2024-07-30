import {DefaultRawTest, DefaultSuite} from './abstract-suite';
import {beforeHead} from './samples';

const suite = new DefaultSuite(beforeHead as DefaultRawTest[]);

beforeAll(() => suite.beforeAll());
beforeEach(() => suite.beforeEach());
describe('Before head mode', () => suite.createSuite());
