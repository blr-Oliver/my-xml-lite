import {default as rawTests} from './samples/comment.json';
import {DefaultTokenizerRawTestCore, DefaultTokenizerTestSuite} from './TokenizerTestSuite.js';

const suite = new DefaultTokenizerTestSuite('CommentTokenizer tests', rawTests as DefaultTokenizerRawTestCore[]);

describe(suite.name, () => suite.makeSuite());