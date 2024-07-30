import {DefaultRawTest, ExcerptSuite} from './abstract-suite.js';
import {inRowParams} from './samples/excerpts';
import {inRow} from './samples/index.js';

const suite = new ExcerptSuite('In row mode', inRow as DefaultRawTest[], inRowParams);

describe(suite.name, () => suite.createSuite());
