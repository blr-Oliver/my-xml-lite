import {DefaultRawTest, DefaultSuite} from './abstract-suite';
import {afterBody} from './samples';

const suite = new DefaultSuite(afterBody as DefaultRawTest[]);

beforeAll(() => suite.beforeAll());
beforeEach(() => suite.beforeEach());
describe('After body mode', () => suite.createSuite());
