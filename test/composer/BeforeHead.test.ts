import {DefaultRawTest, DefaultSuite} from './abstract-suite.js';
import {beforeHead} from './samples/index.js';

const suite = new DefaultSuite('Before head mode', beforeHead as DefaultRawTest[]);

describe(suite.name, () => suite.createSuite());
