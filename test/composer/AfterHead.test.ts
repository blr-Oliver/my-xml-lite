import {DefaultRawTest, ExcerptSuite} from './abstract-suite.js';
import {doctypeOnly} from './samples/excerpts';
import {afterHead} from './samples/index.js';

const suite = new ExcerptSuite('After head mode', afterHead as DefaultRawTest[], doctypeOnly);

describe(suite.name, () => suite.createSuite());
