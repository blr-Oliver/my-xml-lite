import {stringToArray} from '../../src/common/code-sequences';
import {DirectCharacterSource} from '../../src/common/stream-source';
import {HTML_SPECIAL} from '../../src/decl/known-named-refs';
import {ParserEnvironment} from '../../src/decl/ParserEnvironment';
import {buildIndex} from '../../src/impl/build-index';
import {StateBasedTokenizer} from '../../src/impl/StateBasedTokenizer';
import {FixedSizeStringBuilder} from '../../src/impl/FixedSizeStringBuilder';
import {CharactersToken, CommentToken, EOF_TOKEN, Token} from '../../src/impl/tokens';
import {default as rawTests} from './samples/comment.json';

type TestCase = [string/*name*/, string/*input*/, string/*comment data*/, string[]/*errors*/];
const testCases = rawTests as TestCase[];

function suite() {
  let parser!: StateBasedTokenizer;
  let tokenList: Token[] = [];
  let errorList: string[] = [];

  beforeAll(() => {
    parser = new StateBasedTokenizer(buildIndex(HTML_SPECIAL));
    parser.env = {
      buffer: new FixedSizeStringBuilder(1000),
      tokens: {
        accept(token: Token) {
          tokenList.push(token);
        }
      },
      errors: errorList
    } as any as ParserEnvironment;
    parser.tokenQueue = [];
  });

  beforeEach(() => {
    parser.state = 'data';
    parser.active = true;
    parser.env.buffer.clear();
    tokenList.length = 0;
    errorList.length = 0;
  });

  describe('CommentTokenizer tests', () => {
    for (let test of testCases) {
      createTest(test);
    }
    it('separate text and comment', () => {
      processInput('a<!--b-->');
      const [textToken, commentToken] = expectTextAndComment();
      expect(textToken.data).toStrictEqual('a');
      expect(commentToken.data).toStrictEqual('b');
      expect(errorList).toHaveLength(0);
    });
    it('incomplete comment start hyphen', () => {
      processInput('a<!-b-->');
      const [textToken, commentToken] = expectTextAndComment();
      expect(textToken.data).toStrictEqual('a');
      expect(commentToken.data).toStrictEqual('-b--');
      expect(errorList).toStrictEqual(['incorrectly-opened-comment']);
    });
    it('incomplete comment start', () => {
      processInput('a<!b>');
      const [textToken, commentToken] = expectTextAndComment();
      expect(textToken.data).toStrictEqual('a');
      expect(commentToken.data).toStrictEqual('b');
      expect(errorList).toStrictEqual(['incorrectly-opened-comment']);
    });
    it('bogus comment + nested comment', () => {
      processInput('a<!-b<!--c>');
      const [textToken, commentToken] = expectTextAndComment();
      expect(textToken.data).toStrictEqual('a');
      expect(commentToken.data).toStrictEqual('-b<!--c');
      expect(errorList).toStrictEqual(['incorrectly-opened-comment']);
    });
    it('bogus comment unfinished', () => {
      processInput('a<!-bc');
      const [textToken, commentToken] = expectTextAndComment();
      expect(textToken.data).toStrictEqual('a');
      expect(commentToken.data).toStrictEqual('-bc');
      expect(errorList).toStrictEqual(['incorrectly-opened-comment']);
    });

    function expectTextAndComment(): [CharactersToken, CommentToken] {
      expect(parser.state).toStrictEqual('eof');
      expect(tokenList.length).toStrictEqual(3);
      expect(tokenList[0].type).toStrictEqual('characters');
      expect(tokenList[1].type).toStrictEqual('comment');
      expect(tokenList[2]).toBe(EOF_TOKEN);
      return [tokenList[0] as CharactersToken, tokenList[1] as CommentToken];
    }
  });

  function processInput(input: string) {
    const newInput = new DirectCharacterSource(new Uint16Array(stringToArray(input)));
    // @ts-ignore
    parser.env.input = newInput;
    parser.proceed();
  }

  function createTest(test: TestCase) {
    const [name, input, expectedData, expectedErrors] = test;
    it(name, () => {
      processInput(input);
      expect(parser.state).toStrictEqual('eof');
      expect(tokenList.length).toStrictEqual(2);
      expect(tokenList[0].type).toStrictEqual('comment');
      expect(tokenList[1]).toBe(EOF_TOKEN);
      expect((tokenList[0] as CommentToken).data).toStrictEqual(expectedData);
      expect(errorList).toStrictEqual(expectedErrors);
    });
  }
}

suite();