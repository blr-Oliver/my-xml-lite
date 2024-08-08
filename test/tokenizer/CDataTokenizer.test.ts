import {Element} from '../../src/interfaces/dom-types.js';
import {default as rawTests} from './samples/cdata.json';
import {DefaultTokenizerRawTest, DefaultTokenizerTestSuite} from './TokenizerTestSuite.js';
import {TokenListSink} from './TokenListSink.js';

class CDataTokenizerTest extends DefaultTokenizerTestSuite {
  configure() {
    super.configure();
    const composerMock = this.tokenizer.composer as TokenListSink;
    composerMock.inForeignContent = true;
    composerMock.adjustedCurrentNode = {namespaceURI: null} as Element;
  }
}

const suite = new CDataTokenizerTest('CDataTokenizer tests', rawTests as DefaultTokenizerRawTest[]);

describe(suite.name, () => suite.makeSuite());
