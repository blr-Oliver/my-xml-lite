import {DefaultRawTest, ExcerptSuite} from './abstract-suite.js';
import {inSelectParams} from './samples/excerpts';
import {inSelect, inSelectCommon} from './samples/index.js';

const tests = (inSelectCommon as DefaultRawTest[]).concat(inSelect as DefaultRawTest[]);
const suite = new ExcerptSuite('In select mode', tests as DefaultRawTest[], inSelectParams);

describe(suite.name, () => suite.createSuite());
