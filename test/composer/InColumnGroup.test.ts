import {DefaultRawTest, ExcerptSuite} from './abstract-suite.js';
import {inColumnGroupParams} from './samples/excerpts';
import {inColumnGroup} from './samples/index.js';

const suite = new ExcerptSuite('In column group mode', inColumnGroup as DefaultRawTest[], inColumnGroupParams);

describe(suite.name, () => suite.createSuite());
