import {DefaultRawTest, ExcerptSuite} from './abstract-suite.js';
import {doctypeOnly} from './samples/excerpts';
import {inBody} from './samples/index.js';

const suite = new ExcerptSuite('In body mode', inBody as DefaultRawTest[], doctypeOnly);

describe(suite.name, () => suite.createSuite());