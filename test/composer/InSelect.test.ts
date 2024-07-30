import {DefaultRawTest, ExcerptSuite} from './abstract-suite.js';
import {inSelectParams} from './samples/excerpts';
import {inSelect} from './samples/index.js';

const suite = new ExcerptSuite('In select mode', inSelect as DefaultRawTest[] as DefaultRawTest[], inSelectParams);

describe(suite.name, () => suite.createSuite());
