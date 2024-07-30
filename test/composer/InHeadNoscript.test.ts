import {DefaultRawTest, DefaultSuite} from './abstract-suite.js';
import {inHeadNoscript} from './samples/index.js';

const suite = new DefaultSuite('In head noscript mode', inHeadNoscript as DefaultRawTest[]);

describe(suite.name, () => suite.createSuite());
