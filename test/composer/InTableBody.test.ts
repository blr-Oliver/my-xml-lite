import {DefaultRawTest, DefaultSuite} from './abstract-suite.js';
import {inTableBody} from './samples/index.js';

const suite = new DefaultSuite('In table body mode', inTableBody as DefaultRawTest[]);

describe(suite.name, () => suite.createSuite());
