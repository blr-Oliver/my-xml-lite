import {stringToArray} from '../../src/common/code-points';
import {DirectCharacterSource} from '../../src/common/stream-source';
import {HTML_SPECIAL} from '../../src/decl/known-named-refs';
import {ParserEnvironment} from '../../src/decl/ParserEnvironment';
import {buildIndex} from '../../src/impl/character-reference/entity-ref-index';
import {CompositeTokenizer} from '../../src/impl/CompositeTokenizer';
import {FixedSizeStringBuilder} from '../../src/impl/FixedSizeStringBuilder';
import {State} from '../../src/impl/states';
import {CharactersToken, EOF_TOKEN, Token} from '../../src/impl/tokens';
import {default as rawTests} from './samples/cdata.json';

type TestCase = [string/*name*/, string/*input*/, string/*CDATA*/, string[]/*errors*/, boolean/*completed*/];
const testCases = rawTests as TestCase[];

function suite() {
  let parser!: CompositeTokenizer;
  let tokenList: Token[] = [];
  let errorList: string[] = [];
  let lastState!: State;

  beforeAll(() => {
    class MockedCompositeTokenizer extends CompositeTokenizer {
      eof(): State {
        lastState = this.state;
        return super.eof();
      }
    }

    parser = new MockedCompositeTokenizer(buildIndex(HTML_SPECIAL));
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
    lastState = 'data';
  });

  describe('CDataTokenizer tests', () => {
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
      if (hasContent) {
        expect(tokenList.length).toStrictEqual(2);
        expect(tokenList[1]).toBe(EOF_TOKEN);
        token = tokenList[0]!;
        expect(token.type).toStrictEqual('characters');
        expect((token as CharactersToken).data).toStrictEqual(expectedData);
        expect(errorList).toStrictEqual(expectedErrors);
        if (completed) {
          expect(lastState).toStrictEqual('data');
        } else {
          expect(lastState).not.toStrictEqual('data');
        }
      } else {
        expect(tokenList.length).toStrictEqual(1);
        expect(tokenList[0]).toBe(EOF_TOKEN);
        if (completed) {
          expect(lastState).toStrictEqual('data');
        } else {
          expect(lastState).not.toStrictEqual('data');
        }
      }
    });
  }
}

suite();