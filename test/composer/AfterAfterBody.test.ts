import {DefaultRawTest, DefaultSuite} from './abstract-suite';
import {afterAfterBody} from './samples';

const suite = new DefaultSuite(afterAfterBody as DefaultRawTest[]);

beforeAll(() => suite.beforeAll());
beforeEach(() => suite.beforeEach());
describe('After after body mode', () => suite.createSuite());
