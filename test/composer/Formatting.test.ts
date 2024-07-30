import {DefaultRawTest, ExcerptSuite} from './abstract-suite.js';
import {formattingParams} from './samples/excerpts';
import {formatting} from './samples/index.js';

const suite = new ExcerptSuite('Formatting elements', formatting as DefaultRawTest[], formattingParams);

describe(suite.name, () => suite.createSuite());