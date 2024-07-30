import {DefaultRawTest, DefaultSuite} from './abstract-suite.js';
import {afterFrameset} from './samples/index.js';

const suite = new DefaultSuite('After frameset mode', afterFrameset as DefaultRawTest[]);

describe(suite.name, () => suite.createSuite());
