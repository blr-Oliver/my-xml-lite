import {DefaultRawTest, DefaultSuite} from './abstract-suite.js';
import {afterAfterBody} from './samples/index.js';

const suite = new DefaultSuite('After after body mode', afterAfterBody as DefaultRawTest[]);

describe(suite.name, () => suite.createSuite());
