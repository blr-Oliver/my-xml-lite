import {DefaultRawTest, ExcerptSuite} from './abstract-suite.js';
import {doctypeOnly} from './samples/excerpts';
import {inForeignContent} from './samples/index.js';

const suite = new ExcerptSuite(inForeignContent as DefaultRawTest[], doctypeOnly);

beforeAll(() => suite.beforeAll());
beforeEach(() => suite.beforeEach());
describe('In foreign content', () => suite.createSuite());