import {AMPERSAND, EOF, stringToArray, X_REGULAR} from '../../src/common/code-points';
import {DirectCharacterSource} from '../../src/common/stream-source';
import {HTML_SPECIAL} from '../../src/decl/known-named-refs';
import {ParserEnvironment} from '../../src/decl/ParserEnvironment';
import {buildIndex, PrefixNode} from '../../src/impl/character-reference/entity-ref-index';
import {FixedSizeStringBuilder} from '../../src/impl/FixedSizeStringBuilder';
import {BaseTokenizer} from '../../src/impl/fragmented/BaseTokenizer';
import {CharacterReferenceTokenizer} from '../../src/impl/fragmented/CharacterReferenceTokenizer';
import {CompleteTokenizer} from '../../src/impl/fragmented/CompleteTokenizer';
import {State} from '../../src/impl/states';
import {TagTokenizer} from '../../src/impl/fragmented/TagTokenizer';
import {EOF_TOKEN, Token} from '../../src/impl/tokens';
import {Class, combine} from './common/multi-class';
import {default as rawTests} from './samples/char-ref.json';

type TestCase = [string/*name*/, string/*input*/, string/*output*/, string[]/*errors*/, boolean? /*in attribute*/];
const testCases = rawTests as TestCase[];

function suite() {
  let parser!: CharacterReferenceTokenizer;
  let tokenList: Token[] = [];
  let errorList: string[] = [];
  let lastState!: State;

  beforeAll(() => {
    const SyntheticCharacterReferenceTokenizer = combine(
        'SyntheticCharacterReferenceTokenizer',
        BaseTokenizer as Class<BaseTokenizer>,
        TagTokenizer as Class<TagTokenizer>,
        CharacterReferenceTokenizer as Class<CharacterReferenceTokenizer>,
        CompleteTokenizer);

    class PartialCharacterReferenceTokenizer extends SyntheticCharacterReferenceTokenizer {
      constructor(refsIndex: PrefixNode<number[]>) {
        super();
        this.refsIndex = refsIndex;
      }
      attributeValueUnquoted(code: number): State {
        switch (code) {
          case EOF:
            return this.eof();
          case AMPERSAND:
            return super.attributeValueUnquoted(code);
          default:
            this.env.buffer.append(code);
            return 'attributeValueUnquoted';
        }
      }
      protected emitAccumulatedCharacters() {
        // do nothing
      }
      eof(): State {
        lastState = this.state;
        return super.eof();
      }
    }

    parser = new PartialCharacterReferenceTokenizer(buildIndex(HTML_SPECIAL));
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
    parser.referenceStartMark = 0;
    parser.active = true;
    parser.env.buffer.clear();
    parser.env.buffer.append(X_REGULAR);
    tokenList.length = 0;
    errorList.length = 0;
  });

  describe('CharacterReferenceTokenizer tests', () => {
    for (let test of testCases) {
      createTestVariants(test);
    }
  });

  function processInput(input: string) {
    const newInput = new DirectCharacterSource(new Uint16Array(stringToArray(input)));
    // @ts-ignore
    parser.env.input = newInput;
    parser.proceed();
  }

  function createTestVariants(test: TestCase) {
    const [name, input, expectedData, expectedErrors, inAttribute] = test;
    if (typeof inAttribute === 'undefined') {
      createTest([`${name} (in attribute)`, input, expectedData, expectedErrors, true] as TestCase);
      createTest([`${name} (in text)`, input, expectedData, expectedErrors, false] as TestCase);
    } else {
      createTest(test);
    }
  }

  function createTest(test: TestCase) {
    const [name, input, expectedData, expectedErrors, inAttribute] = test;
    it(name, () => {
      const expectedLastState = parser.state = inAttribute ? 'attributeValueUnquoted' : 'data';
      processInput(input);
      expect(parser.state).toStrictEqual('eof');
      expect(tokenList).toHaveLength(1);
      expect(tokenList[0]).toBe(EOF_TOKEN);
      expect(lastState).toStrictEqual(expectedLastState);
      expect(parser.referenceStartMark).toStrictEqual(1);
      const buffer = parser.env.buffer;
      expect(buffer.buffer[0]).toStrictEqual(X_REGULAR);
      expect(buffer.takeString(1)).toStrictEqual(expectedData);
      expect(errorList).toStrictEqual(expectedErrors);
    });
  }
}

suite();