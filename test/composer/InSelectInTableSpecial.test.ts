import {DefaultRawTest, ExcerptSuite} from './abstract-suite.js';
import {inSelectInTableSpecialParams} from './samples/excerpts';
import {inSelectInTableSpecial} from './samples/index.js';

const suite = new ExcerptSuite(inSelectInTableSpecial as DefaultRawTest[], inSelectInTableSpecialParams);

beforeAll(() => suite.beforeAll());
beforeEach(() => suite.beforeEach());
describe('In select in table (table-related tags) mode', () => suite.createSuite());
