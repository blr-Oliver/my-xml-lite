import {DefaultRawTest, ExcerptSuite} from './abstract-suite.js';
import {doctypeOnly} from './samples/excerpts';
import {inHeadNoscript} from './samples/index.js';

const suite = new ExcerptSuite('In head noscript mode', inHeadNoscript as DefaultRawTest[], doctypeOnly);

describe(suite.name, () => suite.createSuite());
