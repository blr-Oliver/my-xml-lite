import {DefaultRawTest, DefaultSuite} from './abstract-suite.js';
import {inForeignContent} from './samples/index.js';

const suite = new DefaultSuite('In foreign content', inForeignContent as DefaultRawTest[]);

describe(suite.name, () => suite.createSuite());