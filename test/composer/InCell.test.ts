import {DefaultRawTest, ExcerptSuite} from './abstract-suite.js';
import {inCellParams} from './samples/excerpts';
import {inCell} from './samples/index.js';

const suite = new ExcerptSuite('In cell mode', inCell as DefaultRawTest[], inCellParams);

describe(suite.name, () => suite.createSuite());
