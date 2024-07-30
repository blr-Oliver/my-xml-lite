import {DefaultRawTest, ExcerptSuite} from './abstract-suite.js';
import {inCaptionParams} from './samples/excerpts';
import {inCaption} from './samples/index.js';

const suite = new ExcerptSuite('In caption mode', inCaption as DefaultRawTest[], inCaptionParams);

describe(suite.name, () => suite.createSuite());
