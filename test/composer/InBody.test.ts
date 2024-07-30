import {DefaultRawTest, ExcerptSuite} from './abstract-suite.js';
import {doctypeOnly} from './samples/excerpts';
import {inBody} from './samples/index.js';

const suite = new ExcerptSuite(inBody as DefaultRawTest[], doctypeOnly);

beforeAll(() => suite.beforeAll());
beforeEach(() => suite.beforeEach());
describe('In body mode', () => suite.createSuite());