import {DefaultRawTest, ExcerptSuite} from './abstract-suite.js';
import {inTableBodyParams} from './samples/excerpts';
import {inTableBody} from './samples/index.js';

const suite = new ExcerptSuite('In table body mode', inTableBody as DefaultRawTest[], inTableBodyParams);

describe(suite.name, () => suite.createSuite());
