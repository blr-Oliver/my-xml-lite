import {DefaultRawTest, DefaultSuite} from './abstract-suite.js';
import {inSelect} from './samples/index.js';

const suite = new DefaultSuite('In select mode', inSelect as DefaultRawTest[] as DefaultRawTest[]);

describe(suite.name, () => suite.createSuite());
