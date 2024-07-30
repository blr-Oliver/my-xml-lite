import {DefaultRawTest, ExcerptSuite} from './abstract-suite.js';
import {inTableParams} from './samples/excerpts';
import {inTable} from './samples/index.js';

const suite = new ExcerptSuite(inTable as DefaultRawTest[], inTableParams);

beforeAll(() => suite.beforeAll());
beforeEach(() => suite.beforeEach());
describe('In table mode', () => suite.createSuite());
