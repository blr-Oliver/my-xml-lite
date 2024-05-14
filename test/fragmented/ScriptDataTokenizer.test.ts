import {stringToArray} from '../../src/common/code-sequences';
import {DirectCharacterSource} from '../../src/common/stream-source';
import {HTML_SPECIAL} from '../../src/decl/known-named-refs';
import {ParserEnvironment} from '../../src/decl/ParserEnvironment';
import {buildIndex} from '../../src/impl/build-index';
import {CompositeTokenizer} from '../../src/impl/CompositeTokenizer';
import {FixedSizeStringBuilder} from '../../src/impl/FixedSizeStringBuilder';
import {State} from '../../src/impl/states';
import {CharactersToken, EOF_TOKEN, TagToken, Token} from '../../src/impl/tokens';
import {default as rawTests} from './samples/script-data.json';

type TestCase = [string/*name*/, string/*input*/, string/*comment data*/, string[]/*errors*/, boolean/*completed*/];
const testCases = rawTests as TestCase[];

function suite() {
  let parser!: CompositeTokenizer;
  let tokenList: Token[] = [];
  let errorList: string[] = [];
  let lastState!: State;

  beforeAll(() => {
    class MockCompositeTokenizer extends CompositeTokenizer {
      data(code: number): State {
        if (tokenList.length === 1 && tokenList[0].type === 'startTag' && (tokenList[0] as TagToken).name === 'script')
          return this.callState('scriptData', code);
        return super.data(code);
      }
      eof(): State {
        lastState = this.state;
        return super.eof();
      }
    }

    parser = new MockCompositeTokenizer(buildIndex(HTML_SPECIAL));
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

  describe('ScriptDataTokenizer tests', () => {
    for (let test of testCases) {
      createTest(test);
    }
  });

  function processInput(input: string) {
    const newInput = new DirectCharacterSource(new Uint16Array(stringToArray(input)));
    // @ts-ignore
    parser.env.input = newInput;
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
        token = tokenList.shift()!;
      }
      expect(token).toBe(EOF_TOKEN);
      expect(errorList).toStrictEqual(expectedErrors);
    });
  }
}

suite();