import {DefaultRawTest, ExcerptSuite} from './abstract-suite.js';
import {inRowParams} from './samples/excerpts';
import {inRow} from './samples/index.js';

const suite = new ExcerptSuite(inRow as DefaultRawTest[], inRowParams);

beforeAll(() => suite.beforeAll());
beforeEach(() => suite.beforeEach());
describe('In row mode', () => suite.createSuite());
