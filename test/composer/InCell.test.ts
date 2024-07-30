import {DefaultRawTest, ExcerptSuite} from './abstract-suite.js';
import {inCellParams} from './samples/excerpts';
import {inCell} from './samples/index.js';

const suite = new ExcerptSuite(inCell as DefaultRawTest[], inCellParams);

beforeAll(() => suite.beforeAll());
beforeEach(() => suite.beforeEach());
describe('In cell mode', () => suite.createSuite());
