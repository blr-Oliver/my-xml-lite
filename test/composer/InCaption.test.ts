import {DefaultRawTest, DefaultSuite} from './abstract-suite.js';
import {inCaption} from './samples/index.js';

const suite = new DefaultSuite('In caption mode', inCaption as DefaultRawTest[]);

describe(suite.name, () => suite.createSuite());
