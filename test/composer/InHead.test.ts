import {DefaultRawTest, ExcerptSuite} from './abstract-suite.js';
import {doctypeOnly} from './samples/excerpts';
import {inHead} from './samples/index.js';

const suite = new ExcerptSuite(inHead as DefaultRawTest[], doctypeOnly);

beforeAll(() => suite.beforeAll());
beforeEach(() => suite.beforeEach());
describe('In head mode', () => suite.createSuite());
