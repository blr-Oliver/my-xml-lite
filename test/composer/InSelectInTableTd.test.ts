import {DefaultRawTest, ExcerptSuite} from './abstract-suite.js';
import {inSelectInTableTdParams} from './samples/excerpts';
import {inSelectCommon, inSelectInTd} from './samples/index.js';

const tdTests = (inSelectCommon as DefaultRawTest[]).concat(inSelectInTd as DefaultRawTest[]);
const tdSuite = new ExcerptSuite(tdTests, inSelectInTableTdParams);

beforeAll(() => tdSuite.beforeAll());
beforeEach(() => tdSuite.beforeEach());
describe('In select in table mode (inside td)', () => tdSuite.createSuite());
