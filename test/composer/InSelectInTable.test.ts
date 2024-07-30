import {DefaultRawTest, DefaultSuite} from './abstract-suite.js';
import {inSelectInTable} from './samples/index.js';

const suite = new DefaultSuite('In select in table mode', inSelectInTable as DefaultRawTest[]);

describe(suite.name, () => suite.createSuite());
