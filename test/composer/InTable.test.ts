import {DefaultRawTest, DefaultSuite} from './abstract-suite.js';
import {inTable} from './samples/index.js';

const suite = new DefaultSuite('In table mode', inTable as DefaultRawTest[]);

describe(suite.name, () => suite.createSuite());
