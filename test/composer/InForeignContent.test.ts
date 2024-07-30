import {DefaultRawTest, ExcerptSuite} from './abstract-suite.js';
import {doctypeOnly} from './samples/excerpts';
import {inForeignContent} from './samples/index.js';

const suite = new ExcerptSuite('In foreign content', inForeignContent as DefaultRawTest[], doctypeOnly);

describe(suite.name, () => suite.createSuite());