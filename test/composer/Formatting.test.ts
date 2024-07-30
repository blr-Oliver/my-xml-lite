import {DefaultRawTest, DefaultSuite} from './abstract-suite.js';
import {formatting} from './samples/index.js';

const suite = new DefaultSuite('Formatting elements', formatting as DefaultRawTest[]);

describe(suite.name, () => suite.createSuite());