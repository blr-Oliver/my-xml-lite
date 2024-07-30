import {DefaultRawTest, DefaultSuite} from './abstract-suite.js';
import {afterAfterFrameset} from './samples/index.js';

const suite = new DefaultSuite('After after frameset mode', afterAfterFrameset as DefaultRawTest[]);

describe(suite.name, () => suite.createSuite());
