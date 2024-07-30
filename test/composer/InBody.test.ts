import {DefaultRawTest, DefaultSuite} from './abstract-suite.js';
import {inBody} from './samples/index.js';

const suite = new DefaultSuite('In body mode', inBody as DefaultRawTest[]);

describe(suite.name, () => suite.createSuite());