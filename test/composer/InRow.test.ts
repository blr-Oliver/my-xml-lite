import {DefaultRawTest, DefaultSuite} from './abstract-suite.js';
import {inRow} from './samples/index.js';

const suite = new DefaultSuite('In row mode', inRow as DefaultRawTest[]);

describe(suite.name, () => suite.createSuite());
