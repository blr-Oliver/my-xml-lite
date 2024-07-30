import {DefaultRawTest, ExcerptSuite} from './abstract-suite.js';
import {inTableBodyParams} from './samples/excerpts';
import {inTableBody} from './samples/index.js';

const suite = new ExcerptSuite(inTableBody as DefaultRawTest[], inTableBodyParams);

beforeAll(() => suite.beforeAll());
beforeEach(() => suite.beforeEach());
describe('In table body mode', () => suite.createSuite());
