import {DefaultRawTest, ExcerptSuite} from './abstract-suite.js';
import {inSelectInTableTdParams} from './samples/excerpts';
import {inSelectCommon, inSelectInTd} from './samples/index.js';

const tdTests = (inSelectCommon as DefaultRawTest[]).concat(inSelectInTd as DefaultRawTest[]);
const suite = new ExcerptSuite('In select in table mode (inside td)', tdTests, inSelectInTableTdParams);

describe(suite.name, () => suite.createSuite());
