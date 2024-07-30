import {DefaultRawTest, DefaultSuite} from './abstract-suite.js';
import {inSelectInTd} from './samples/index.js';

const suite = new DefaultSuite('In select in table mode (inside td)', inSelectInTd as DefaultRawTest[]);

describe(suite.name, () => suite.createSuite());
