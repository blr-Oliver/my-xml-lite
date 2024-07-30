import {DefaultRawTest, DefaultSuite} from './abstract-suite.js';
import {beforeHtml} from './samples/index.js';

const suite = new DefaultSuite(beforeHtml as DefaultRawTest[]);

beforeAll(() => suite.beforeAll());
beforeEach(() => suite.beforeEach());
describe('Before html mode', () => suite.createSuite());
