import {DefaultRawTest, DefaultSuite} from './abstract-suite.js';
import {beforeHtml} from './samples/index.js';

const suite = new DefaultSuite('Before html mode', beforeHtml as DefaultRawTest[]);

describe(suite.name, () => suite.createSuite());
