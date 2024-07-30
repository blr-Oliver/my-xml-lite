import {DefaultRawTest, DefaultSuite} from './abstract-suite.js';
import {inColumnGroup} from './samples/index.js';

const suite = new DefaultSuite('In column group mode', inColumnGroup as DefaultRawTest[]);

describe(suite.name, () => suite.createSuite());
