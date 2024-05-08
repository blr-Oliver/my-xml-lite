import {EOF, stringToArray} from '../../src/common/code-points';
import {DirectCharacterSource} from '../../src/common/stream-source';
import {ParserEnvironment} from '../../src/decl/ParserEnvironment';
import {FixedSizeStringBuilder} from '../../src/impl/FixedSizeStringBuilder';
import {BaseTokenizer} from '../../src/impl/fragmented/BaseTokenizer';
import {CommentTokenizer} from '../../src/impl/fragmented/CommentTokenizer';
import {CompleteTokenizer} from '../../src/impl/fragmented/CompleteTokenizer';
import {State} from '../../src/impl/fragmented/states';
import {CommentToken, EOF_TOKEN, Token} from '../../src/impl/tokens';
import {Class, combine} from './common/multi-class';
import {default as rawTests} from './samples/comment.json';

type TestCase = [string/*name*/, string/*input*/, string/*comment data*/, string[]/*errors*/];
const testCases = rawTests as TestCase[];

function suite() {
  let parser!: CommentTokenizer;
  let tokenList: Token[] = [];
  let errorList: string[] = [];

  beforeAll(() => {
    class PartialCommentTokenizer extends CommentTokenizer {
      data(code: number): State {
        if (code === EOF) return this.eof();
        // skip first four characters and go straight to comment start
        this.nextCode();
        this.nextCode();
        this.nextCode();
        this.startNewComment();
        this.state = 'commentStart';
        return this.commentStart(this.nextCode());
      }
    }

    const SyntheticCommentTokenizer = combine(
        'SyntheticCommentTokenizer',
        BaseTokenizer as Class<BaseTokenizer>,
        CommentTokenizer as Class<CommentTokenizer>,
        CompleteTokenizer,
        PartialCommentTokenizer);
    parser = new SyntheticCommentTokenizer();
    parser.env = {
      buffer: new FixedSizeStringBuilder(1000),
      state: 'data',
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
  });

  function createTest(test: TestCase) {
    const [name, input, expectedData, expectedErrors] = test;
    it(name, () => {
      const newInput = new DirectCharacterSource(new Uint16Array(stringToArray(input)));
      // @ts-ignore
      parser.env.input = newInput;
      parser.proceed();
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