import {DefaultRawTest, ExcerptSuite} from './abstract-suite.js';
import {inSelectInTableTableParams} from './samples/excerpts';
import {inSelectCommon, inSelectInTable} from './samples/index.js';

const tableTests = (inSelectCommon as DefaultRawTest[]).concat(inSelectInTable as DefaultRawTest[]);
const suite = new ExcerptSuite('In select in table mode (inside table)', tableTests, inSelectInTableTableParams);

describe(suite.name, () => suite.createSuite());
