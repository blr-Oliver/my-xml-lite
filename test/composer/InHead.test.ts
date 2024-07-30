import {DefaultRawTest, DefaultSuite} from './abstract-suite.js';
import {inHead} from './samples/index.js';

const suite = new DefaultSuite('In head mode', inHead as DefaultRawTest[]);

describe(suite.name, () => suite.createSuite());
