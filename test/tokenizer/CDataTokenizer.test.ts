import {stringToArray} from '../../src/common/code-sequences.js';
import {DirectCharacterSource} from '../../src/common/stream-source.js';
import {Element} from '../../src/decl/dom-like.js';
import {HTML_SPECIAL} from '../../src/decl/known-named-refs.js';
import {buildIndex} from '../../src/impl/build-index.js';
import {State} from '../../src/impl/interfaces/states.js';
import {CDataToken, CharactersToken, CommentToken, EOF_TOKEN, Token} from '../../src/impl/interfaces/tokens.js';
import {Tokenizer} from '../../src/impl/Tokenizer.js';
import {default as rawTests} from './samples/cdata.json';
import {TokenListSink} from './TokenListSink.js';

type TestCase = [string/*name*/, string/*input*/, string/*CDATA*/, string[]/*errors*/, boolean/*completed*/];
const testCases = rawTests as TestCase[];

function suite() {
  let parser!: Tokenizer;
  let tokenList: Token[] = [];
  let errorList: string[] = [];
  let lastState!: State;

  beforeAll(() => {
    class MockCompositeTokenizer extends Tokenizer {
      eof(): State {
        lastState = this.state;
        return super.eof();
      }
    }

    parser = new MockCompositeTokenizer(buildIndex(HTML_SPECIAL), error => errorList.push(error));
    const composerMock = new TokenListSink(tokenList);
    composerMock.adjustedCurrentNode = {namespaceURI: null} as unknown as Element;
    parser.composer = composerMock;
    parser.tokenQueue = [];
  });

  beforeEach(() => {
    parser.state = 'data';
    parser.active = true;
    parser.buffer.clear();
    tokenList.length = 0;
    errorList.length = 0;
  });

  describe('CDataTokenizer tests', () => {
    for (let test of testCases) {
      createTest(test);
    }
    it('separate text and CDATA', () => {
      processInput('a<![CDATA[b]]>');
      expect(parser.state).toStrictEqual('eof');
      expect(tokenList.length).toStrictEqual(3);
      expect(tokenList[2]).toBe(EOF_TOKEN);
      expect(tokenList[0].type).toStrictEqual('characters');
      expect(tokenList[1].type).toStrictEqual('cdata');
      const textToken = tokenList[0] as CharactersToken;
      const cdataToken = tokenList[1] as CDataToken;
      expect(textToken.data).toStrictEqual('a');
      expect(cdataToken.data).toStrictEqual('b');
      expect(errorList).toHaveLength(0);
      expect(lastState).toStrictEqual('data');
    });
    it('incomplete CDATA start', () => {
      processInput('a<![CDb>');
      expect(parser.state).toStrictEqual('eof');
      expect(tokenList.length).toStrictEqual(3);
      expect(tokenList[2]).toBe(EOF_TOKEN);
      expect(tokenList[0].type).toStrictEqual('characters');
      expect(tokenList[1].type).toStrictEqual('comment');
      const textToken = tokenList[0] as CharactersToken;
      const commentToken = tokenList[1] as CommentToken;
      expect(textToken.data).toStrictEqual('a');
      expect(commentToken.data).toStrictEqual('[CDb');
      expect(errorList).toStrictEqual(['incorrectly-opened-comment']);
      expect(lastState).toStrictEqual('data');
    })
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
      expect(parser.state).toStrictEqual('eof');
      expect(tokenList.length).toStrictEqual(2);
      expect(tokenList[1]).toBe(EOF_TOKEN);
      token = tokenList[0]!;
      expect(token.type).toStrictEqual('cdata');
      expect((token as CharactersToken).data).toStrictEqual(expectedData);
      expect(errorList).toStrictEqual(expectedErrors);
      if (completed) {
        expect(lastState).toStrictEqual('data');
      } else {
        expect(lastState).not.toStrictEqual('data');
      }
    });
  }
}

suite();