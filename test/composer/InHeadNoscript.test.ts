import {DefaultRawTest, ExcerptSuite} from './abstract-suite.js';
import {doctypeOnly} from './samples/excerpts';
import {inHeadNoscript} from './samples/index.js';

const suite = new ExcerptSuite(inHeadNoscript as DefaultRawTest[], doctypeOnly);

beforeAll(() => suite.beforeAll());
beforeEach(() => suite.beforeEach());
describe('In head noscript mode', () => suite.createSuite());
