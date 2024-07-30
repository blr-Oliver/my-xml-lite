import {DefaultRawTest, DefaultSuite} from './abstract-suite.js';
import {inSelectInTableSpecial} from './samples/index.js';

const suite = new DefaultSuite('In select in table (table-related tags) mode', inSelectInTableSpecial as DefaultRawTest[]);

describe(suite.name, () => suite.createSuite());
