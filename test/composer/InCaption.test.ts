import {DefaultRawTest, ExcerptSuite} from './abstract-suite.js';
import {inCaptionParams} from './samples/excerpts';
import {inCaption} from './samples/index.js';

const suite = new ExcerptSuite(inCaption as DefaultRawTest[], inCaptionParams);

beforeAll(() => suite.beforeAll());
beforeEach(() => suite.beforeEach());
describe('In caption mode', () => suite.createSuite());
