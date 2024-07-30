import {DefaultRawTest, ExcerptSuite} from './abstract-suite.js';
import {doctypeOnly} from './samples/excerpts';
import {afterHead} from './samples/index.js';

const suite = new ExcerptSuite(afterHead as DefaultRawTest[], doctypeOnly);

beforeAll(() => suite.beforeAll());
beforeEach(() => suite.beforeEach());
describe('After head mode', () => suite.createSuite());
