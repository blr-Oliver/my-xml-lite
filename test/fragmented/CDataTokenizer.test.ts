import {EOF, stringToArray} from '../../src/common/code-points';
import {DirectCharacterSource} from '../../src/common/stream-source';
import {ParserEnvironment} from '../../src/decl/ParserEnvironment';
import {FixedSizeStringBuilder} from '../../src/impl/FixedSizeStringBuilder';
import {BaseTokenizer} from '../../src/impl/fragmented/BaseTokenizer';
import {CDataTokenizer} from '../../src/impl/fragmented/CDataTokenizer';
import {CompleteTokenizer} from '../../src/impl/fragmented/CompleteTokenizer';
import {SequenceMatcher} from '../../src/impl/fragmented/SequenceMatcher';
import {State} from '../../src/impl/fragmented/states';
import {CharactersToken, EOF_TOKEN, Token} from '../../src/impl/tokens';
import {Class, combine} from './common/multi-class';
import {default as rawTests} from './samples/cdata.json';

type TestCase = [string/*name*/, string/*input*/, string/*CDATA*/, string[]/*errors*/, boolean/*completed*/];
const testCases = rawTests as TestCase[];

function suite() {
  let parser!: CDataTokenizer;
  let tokenList: Token[] = [];
  let errorList: string[] = [];
  let lastState!: State;

  beforeAll(() => {
    const SyntheticCDataTokenizer = combine(
        'SyntheticCDataTokenizer',
        BaseTokenizer as Class<BaseTokenizer>,
        SequenceMatcher as Class<SequenceMatcher>,
        CDataTokenizer as Class<CDataTokenizer>,
        CompleteTokenizer as Class<CompleteTokenizer>);

    class PartialCDataTokenizer extends SyntheticCDataTokenizer {
      data(code: number): State {
        if (code === EOF) return this.eof();
        // skip prolog and go straight to interesting part
        const len = '<![CDATA['.length;
        for (let i = 1; i < len; ++i)
          this.nextCode();
        this.state = 'cdataSection';
        return this.cdataSection(this.nextCode());
      }
      eof(): State {
        lastState = this.state;
        return super.eof();
      }
    }

    parser = new PartialCDataTokenizer();
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

  function createTest(test: TestCase) {
    const [name, input, expectedData, expectedErrors, completed] = test;
    it(name, () => {
      let token: Token;
      const newInput = new DirectCharacterSource(new Uint16Array(stringToArray(input)));
      // @ts-ignore
      parser.env.input = newInput;
      parser.proceed();
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