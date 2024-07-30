import {DefaultRawTest, ExcerptSuite} from './abstract-suite.js';
import {inSelectInTableTableParams} from './samples/excerpts';
import {inSelectCommon, inSelectInTable} from './samples/index.js';

const tableTests = (inSelectCommon as DefaultRawTest[]).concat(inSelectInTable as DefaultRawTest[]);
const tableSuite = new ExcerptSuite(tableTests, inSelectInTableTableParams);

beforeAll(() => tableSuite.beforeAll());
beforeEach(() => tableSuite.beforeEach());
describe('In select in table mode (inside table)', () => tableSuite.createSuite());
