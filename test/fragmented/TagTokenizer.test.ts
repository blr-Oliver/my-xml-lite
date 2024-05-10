import {stringToArray} from '../../src/common/code-points';
import {DirectCharacterSource} from '../../src/common/stream-source';
import {HTML_SPECIAL} from '../../src/decl/known-named-refs';
import {ParserEnvironment} from '../../src/decl/ParserEnvironment';
import {buildIndex, PrefixNode} from '../../src/impl/character-reference/entity-ref-index';
import {FixedSizeStringBuilder} from '../../src/impl/FixedSizeStringBuilder';
import {BaseTokenizer} from '../../src/impl/fragmented/BaseTokenizer';
import {CharacterReferenceTokenizer} from '../../src/impl/fragmented/CharacterReferenceTokenizer';
import {CompleteTokenizer} from '../../src/impl/fragmented/CompleteTokenizer';
import {State} from '../../src/impl/fragmented/states';
import {TagTokenizer} from '../../src/impl/fragmented/TagTokenizer';
import {EOF_TOKEN, TagToken, Token} from '../../src/impl/tokens';
import {Class, combine} from './common/multi-class';
import {default as rawTests} from './samples/tags.json';

type AttributeData = [string, string | null];
type TestCase = [
  string/*name*/,
  string/*input*/,
  string/*tag name*/,
  boolean/*start/end*/,
  boolean/*self-closing*/,
  AttributeData[],
  string[]/*errors*/,
  boolean/*completed*/
];
const testCases = rawTests as TestCase[];

function suite() {
  let parser!: TagTokenizer;
  let tokenList: Token[] = [];
  let errorList: string[] = [];
  let lastState!: State;

  beforeAll(() => {
    const SyntheticTagTokenizer = combine(
        'SyntheticTagTokenizer',
        BaseTokenizer as Class<BaseTokenizer>,
        CharacterReferenceTokenizer as Class<CharacterReferenceTokenizer>,
        TagTokenizer as Class<TagTokenizer>,
        CompleteTokenizer as Class<CompleteTokenizer>);

    class PartialTagTokenizer extends SyntheticTagTokenizer {
      constructor(refsIndex: PrefixNode<number[]>) {
        super();
        this.refsIndex = refsIndex;
      }
      eof(): State {
        lastState = this.state;
        return super.eof();
      }
    }

    parser = new PartialTagTokenizer(buildIndex(HTML_SPECIAL));
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

  describe('TagTokenizer tests', () => {
    for (let test of testCases) {
      createTest(test);
    }
  });

  function createTest(test: TestCase) {
    const [name, input, expectedTagName, expectedIsStart, expectedSelfClosing, expectedAttributes, expectedErrors, completed] = test;
    it(name, () => {
      const newInput = new DirectCharacterSource(new Uint16Array(stringToArray(input)));
      // @ts-ignore
      parser.env.input = newInput;
      parser.proceed();
      expect(parser.state).toStrictEqual('eof');
      if (!completed) {
        expect(tokenList).toHaveLength(1);
        expect(tokenList[0]).toBe(EOF_TOKEN);
      } else {
        expect(tokenList).toHaveLength(2);
        expect(tokenList[1]).toBe(EOF_TOKEN);
        const token = tokenList[0] as TagToken;
        expect(token.name).toStrictEqual(expectedTagName);
        expect(token.type).toStrictEqual(expectedIsStart ? 'startTag' : 'endTag');
        expect(token.selfClosing).toStrictEqual(expectedSelfClosing);
        expect(token.attributes).toHaveLength(expectedAttributes.length);
        for (let i = 0; i < expectedAttributes.length; ++i) {
          const expectedAttribute = expectedAttributes[i];
          const actualAttribute = token.attributes[i];
          expect(actualAttribute).toBeDefined();
          expect(actualAttribute.name).toStrictEqual(expectedAttribute[0]);
          expect(actualAttribute.value).toStrictEqual(expectedAttribute[1]);
        }
      }
      expect(errorList).toStrictEqual(expectedErrors);
    });
  }
}

suite();