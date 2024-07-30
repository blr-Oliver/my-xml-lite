import {DefaultRawTest, DefaultSuite} from './abstract-suite.js';
import {inCell} from './samples/index.js';

const suite = new DefaultSuite('In cell mode', inCell as DefaultRawTest[]);

describe(suite.name, () => suite.createSuite());
