import {DefaultRawTest, ExcerptSuite} from './abstract-suite.js';
import {inTableParams} from './samples/excerpts';
import {inTable} from './samples/index.js';

const suite = new ExcerptSuite('In table mode', inTable as DefaultRawTest[], inTableParams);

describe(suite.name, () => suite.createSuite());
