import {DefaultRawTest, DefaultSuite} from './abstract-suite.js';
import {afterBody} from './samples/index.js';

const suite = new DefaultSuite('After body mode', afterBody as DefaultRawTest[]);

describe(suite.name, () => suite.createSuite());
