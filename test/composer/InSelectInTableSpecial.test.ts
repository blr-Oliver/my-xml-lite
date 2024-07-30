import {DefaultRawTest, ExcerptSuite} from './abstract-suite.js';
import {inSelectInTableSpecialParams} from './samples/excerpts';
import {inSelectInTableSpecial} from './samples/index.js';

const suite = new ExcerptSuite('In select in table (table-related tags) mode', inSelectInTableSpecial as DefaultRawTest[], inSelectInTableSpecialParams);

describe(suite.name, () => suite.createSuite());
