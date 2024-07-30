import {DefaultRawTest, DefaultSuite} from './abstract-suite.js';
import {inFrameset} from './samples/index.js';

const suite = new DefaultSuite('In frameset mode', inFrameset as DefaultRawTest[]);

describe(suite.name, () => suite.createSuite());
