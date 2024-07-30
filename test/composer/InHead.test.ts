import {DefaultRawTest, ExcerptSuite} from './abstract-suite.js';
import {doctypeOnly} from './samples/excerpts';
import {inHead} from './samples/index.js';

const suite = new ExcerptSuite('In head mode', inHead as DefaultRawTest[], doctypeOnly);

describe(suite.name, () => suite.createSuite());
