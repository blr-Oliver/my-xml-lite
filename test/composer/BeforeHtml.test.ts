import {DefaultRawTest, DefaultSuite} from './abstract-suite';
import {beforeHtml} from './samples';

const suite = new DefaultSuite(beforeHtml as DefaultRawTest[]);

beforeAll(() => suite.beforeAll());
beforeEach(() => suite.beforeEach());
describe('Before html mode', () => suite.createSuite());
