import {DefaultRawTest, ExcerptSuite} from './abstract-suite.js';
import {inSelectInTableTdParams} from './samples/excerpts';
import {inSelectInTd} from './samples/index.js';

const suite = new ExcerptSuite('In select in table mode (inside td)', inSelectInTd as DefaultRawTest[], inSelectInTableTdParams);

describe(suite.name, () => suite.createSuite());
