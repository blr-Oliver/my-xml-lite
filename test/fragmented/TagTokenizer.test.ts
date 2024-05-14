import {stringToArray} from '../../src/common/code-points';
import {DirectCharacterSource} from '../../src/common/stream-source';
import {HTML_SPECIAL} from '../../src/decl/known-named-refs';
import {ParserEnvironment} from '../../src/decl/ParserEnvironment';
import {buildIndex} from '../../src/impl/character-reference/entity-ref-index';
import {CompositeTokenizer} from '../../src/impl/CompositeTokenizer';
import {FixedSizeStringBuilder} from '../../src/impl/FixedSizeStringBuilder';
import {State} from '../../src/impl/states';
import {CharactersToken, CommentToken, EOF_TOKEN, TagToken, Token} from '../../src/impl/tokens';
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
  let parser!: CompositeTokenizer;
  let tokenList: Token[] = [];
  let errorList: string[] = [];
  let lastState!: State;

  beforeAll(() => {
    class MockCompositeTokenizer extends CompositeTokenizer {
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
    lastState = 'data';
  });

  describe('TagTokenizer tests', () => {
    for (let test of testCases) {
      createTest(test);
    }
    it('eof before start tag name', () => {
      processInput('<');
      expect(parser.state).toStrictEqual('eof');
      expect(tokenList).toHaveLength(2);
      expect(tokenList[1]).toBe(EOF_TOKEN);
      expect(tokenList[0].type).toStrictEqual('characters');
      expect((tokenList[0] as CharactersToken).data).toStrictEqual('<');
      expect(errorList).toStrictEqual(['eof-before-tag-name']);
    });

    it('eof before end tag name', () => {
      processInput('</');
      expect(parser.state).toStrictEqual('eof');
      expect(tokenList).toHaveLength(2);
      expect(tokenList[1]).toBe(EOF_TOKEN);
      expect(tokenList[0].type).toStrictEqual('characters');
      expect((tokenList[0] as CharactersToken).data).toStrictEqual('</');
      expect(errorList).toStrictEqual(['eof-before-tag-name']);
    });

    it('missing start tag name', () => {
      processInput('<>');
      expect(parser.state).toStrictEqual('eof');
      expect(tokenList).toHaveLength(2);
      expect(tokenList[1]).toBe(EOF_TOKEN);
      expect(tokenList[0].type).toStrictEqual('characters');
      expect((tokenList[0] as CharactersToken).data).toStrictEqual('<>');
      expect(errorList).toStrictEqual(['invalid-first-character-of-tag-name']);
    });

    it('missing end tag name', () => {
      processInput('</>');
      expect(parser.state).toStrictEqual('eof');
      expect(tokenList).toHaveLength(1);
      expect(tokenList[0]).toBe(EOF_TOKEN);
      expect(errorList).toStrictEqual(['missing-end-tag-name']);
    });

    it('invalid start tag name', () => {
      processInput('< >');
      expect(parser.state).toStrictEqual('eof');
      expect(tokenList).toHaveLength(2);
      expect(tokenList[1]).toBe(EOF_TOKEN);
      expect(tokenList[0].type).toStrictEqual('characters');
      expect((tokenList[0] as CharactersToken).data).toStrictEqual('< >');
      expect(errorList).toStrictEqual(['invalid-first-character-of-tag-name']);
    });

    it('invalid end tag name', () => {
      processInput('</ >');
      expect(parser.state).toStrictEqual('eof');
      expect(tokenList).toHaveLength(2);
      expect(tokenList[1]).toBe(EOF_TOKEN);
      expect(tokenList[0].type).toStrictEqual('comment');
      expect((tokenList[0] as CommentToken).data).toStrictEqual(' ');
      expect(errorList).toStrictEqual(['invalid-first-character-of-tag-name']);
    });

  });

  function processInput(input: string) {
    const newInput = new DirectCharacterSource(new Uint16Array(stringToArray(input)));
    // @ts-ignore
    parser.env.input = newInput;
    parser.proceed();
  }

  function createTest(test: TestCase) {
    const [name, input, expectedTagName, expectedIsStart, expectedSelfClosing, expectedAttributes, expectedErrors, completed] = test;
    it(name, () => {
      processInput(input);
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