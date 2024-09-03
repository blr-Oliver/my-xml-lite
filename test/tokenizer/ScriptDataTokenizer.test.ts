import {State} from '../../src/impl/interfaces/states.js';
import {TagToken, Token, TokenType} from '../../src/impl/interfaces/tokens.js';
import {Tokenizer} from '../../src/impl/Tokenizer.js';
import {default as rawTests} from './samples/script-data.json';
import {DefaultTokenizerRawTest, DefaultTokenizerTestSuite} from './TokenizerTestSuite.js';
import {TokenListSink} from './TokenListSink.js';

class ScriptSensitiveTokenSink extends TokenListSink {
  tokenizer: Tokenizer;

  constructor(tokens: Token[], tokenizer: Tokenizer) {
    super(tokens);
    this.tokenizer = tokenizer;
  }
  accept(token: Token) {
    super.accept(token);
    if (token.type === TokenType.START_TAG && (token as TagToken).name === 'script') {
      this.tokenizer.state = State.SCRIPT_DATA;
      this.tokenizer.lastOpenTag = 'script';
    }
  }
}

class ScriptDataTokenizerTest extends DefaultTokenizerTestSuite {
  configure() {
    this.tokenizer.composer = new ScriptSensitiveTokenSink(this.tokenList, this.tokenizer);
  }
}

const suite = new ScriptDataTokenizerTest('ScriptDataTokenizer tests', rawTests as DefaultTokenizerRawTest[]);

describe(suite.name, () => suite.makeSuite());