import {DefaultRawTest, ExcerptSuite} from './abstract-suite.js';
import {inSelectInTableTableParams} from './samples/excerpts';
import {inSelectInTable} from './samples/index.js';

const suite = new ExcerptSuite('In select in table mode (inside table)', inSelectInTable as DefaultRawTest[], inSelectInTableTableParams);

describe(suite.name, () => suite.createSuite());
