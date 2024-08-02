import {stringToArray} from '../../src/common/code-sequences.js';
import {DirectCharacterSource} from '../../src/common/stream-source.js';
import {HTML_SPECIAL} from '../../src/decl/known-named-refs.js';
import {buildIndex} from '../../src/impl/build-index.js';
import {State} from '../../src/impl/interfaces/states.js';
import {CharactersToken, EOF_TOKEN, TagToken, Token} from '../../src/impl/interfaces/tokens.js';
import {Tokenizer} from '../../src/impl/Tokenizer.js';
import {default as rawTests} from './samples/script-data.json';
import {TokenListSink} from './TokenListSink.js';

type TestCase = [string/*name*/, string/*input*/, string/*comment data*/, string[]/*errors*/, boolean/*completed*/];
const testCases = rawTests as TestCase[];

function suite() {
  let parser!: Tokenizer;
  let tokenList: Token[] = [];
  let errorList: string[] = [];
  let lastState!: State;

  beforeAll(() => {
    class MockCompositeTokenizer extends Tokenizer {
      data(code: number): State {
        if (tokenList.length === 1 && tokenList[0].type === 'startTag' && (tokenList[0] as TagToken).name === 'script') {
          parser.lastOpenTag = 'script';
          return this.callState('scriptData', code);
        }
        return super.data(code);
      }
      eof(): State {
        lastState = this.state;
        return super.eof();
      }
    }

    parser = new MockCompositeTokenizer(buildIndex(HTML_SPECIAL), error => errorList.push(error));
    parser.composer = new TokenListSink(tokenList);
    parser.tokenQueue = [];
  });

  beforeEach(() => {
    parser.state = 'data';
    parser.active = true;
    parser.buffer.clear();
    tokenList.length = 0;
    errorList.length = 0;
  });

  describe('ScriptDataTokenizer tests', () => {
    for (let test of testCases) {
      createTest(test);
    }
  });

  function processInput(input: string) {
    const newInput = new DirectCharacterSource(new Uint16Array(stringToArray(input)));
    parser.input = newInput;
    parser.proceed();
  }

  function createTest(test: TestCase) {
    const [name, input, expectedData, expectedErrors, completed] = test;
    it(name, () => {
      let token: Token;
      processInput(input);
      const hasContent = expectedData !== '';
      expect(parser.state).toStrictEqual('eof');
      const expectedTokenCount = 2 + (+hasContent) + (+completed);
      expect(tokenList.length).toStrictEqual(expectedTokenCount);
      token = tokenList.shift()!;
      expect(token.type).toStrictEqual('startTag');
      expect((token as TagToken).name).toStrictEqual('script');
      token = tokenList.shift()!;
      if (hasContent) {
        expect(token.type).toStrictEqual('characters');
        expect((token as CharactersToken).data).toStrictEqual(expectedData);
        token = tokenList.shift()!;
      }
      if (completed) {
        expect(token.type).toStrictEqual('endTag');
        expect((token as TagToken).name).toStrictEqual('script');
        expect(parser.lastOpenTag).toBeUndefined();
        token = tokenList.shift()!;
      } else
        expect(parser.lastOpenTag).toStrictEqual('script');
      expect(token).toBe(EOF_TOKEN);
      expect(errorList).toStrictEqual(expectedErrors);
    });
  }
}

suite();