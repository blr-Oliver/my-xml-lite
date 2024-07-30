import {DefaultRawTest, DefaultSuite} from './abstract-suite.js';
import {afterHead} from './samples/index.js';

const suite = new DefaultSuite('After head mode', afterHead as DefaultRawTest[]);

describe(suite.name, () => suite.createSuite());
