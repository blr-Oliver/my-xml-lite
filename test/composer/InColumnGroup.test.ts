import {DefaultRawTest, ExcerptSuite} from './abstract-suite.js';
import {inColumnGroupParams} from './samples/excerpts';
import {inColumnGroup} from './samples/index.js';

const suite = new ExcerptSuite(inColumnGroup as DefaultRawTest[], inColumnGroupParams);

beforeAll(() => suite.beforeAll());
beforeEach(() => suite.beforeEach());
describe('In column group mode', () => suite.createSuite());
