import {DefaultRawTest, ExcerptSuite} from './abstract-suite.js';
import {formattingParams} from './samples/excerpts';
import {formatting} from './samples/index.js';

const suite = new ExcerptSuite(formatting as DefaultRawTest[], formattingParams);

beforeAll(() => suite.beforeAll());
beforeEach(() => suite.beforeEach());
describe('Formatting elements', () => suite.createSuite());