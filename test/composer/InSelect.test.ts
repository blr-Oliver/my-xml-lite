import {DefaultRawTest, ExcerptSuite} from './abstract-suite.js';
import {inSelectParams} from './samples/excerpts';
import {inSelect, inSelectCommon} from './samples/index.js';

const tests = (inSelectCommon as DefaultRawTest[]).concat(inSelect as DefaultRawTest[]);
const suite = new ExcerptSuite(tests as DefaultRawTest[], inSelectParams);

beforeAll(() => suite.beforeAll());
beforeEach(() => suite.beforeEach());
describe('In select mode', () => suite.createSuite());
