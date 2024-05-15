import {stringToArray} from '../../src/common/code-sequences';
import {DirectCharacterSource} from '../../src/common/stream-source';
import {PrefixNode} from '../../src/decl/entity-ref-index';
import {HTML_SPECIAL} from '../../src/decl/known-named-refs';
import {ParserEnvironment} from '../../src/decl/ParserEnvironment';
import {buildIndex} from '../../src/impl/build-index';
import {CompositeTokenizer} from '../../src/impl/CompositeTokenizer';
import {FixedSizeStringBuilder} from '../../src/impl/FixedSizeStringBuilder';
import {State} from '../../src/impl/states';
import {CharactersToken, CommentToken, DoctypeToken, EOF_TOKEN, Token} from '../../src/impl/tokens';
import {default as rawTests} from './samples/doctype.json';

type TestCase = [string/*name*/, string/*input*/, string | null/*doctype name*/, string | null/*public id*/, string | null/*system id*/, boolean/*force quirks*/, string[]/*errors*/];
const testCases = rawTests as TestCase[];

function suite() {
  let parser!: CompositeTokenizer;
  let tokenList: Token[] = [];
  let errorList: string[] = [];
  let lastState!: State;

  beforeAll(() => {

    class MockCompositeTokenizer extends CompositeTokenizer {
      constructor(refsIndex: PrefixNode<number[]>) {
        super(refsIndex);
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
    lastState = 'data';
  });

  describe('DoctypeTokenizer tests', () => {
    for (let test of testCases) {
      createTest(test);
    }
    it('prepended with characters', () => {
      processInput('ABC<!DOCTYPE html>');
      expect(parser.state).toStrictEqual('eof');
      expect(tokenList).toHaveLength(3);
      expect(tokenList[2]).toBe(EOF_TOKEN);
      const characters: CharactersToken = tokenList[0] as CharactersToken;
      const doctype: DoctypeToken = tokenList[1] as DoctypeToken;
      expect(characters.type).toStrictEqual('characters');
      expect(characters.data).toStrictEqual('ABC');
      expect(doctype.type).toStrictEqual('doctype');
      expect(doctype.name).toStrictEqual('html');
      expect(doctype.publicId).toBeUndefined();
      expect(doctype.systemId).toBeUndefined();
      expect(doctype.forceQuirks).toStrictEqual(false);
      expect(errorList).toHaveLength(0);
    });
    it('failed doctype', () => {
      processInput('abc<!doc html>def');
      expect(parser.state).toStrictEqual('eof');
      expect(tokenList).toHaveLength(4);
      expect(tokenList[0].type).toBe('characters');
      expect(tokenList[1].type).toBe('comment');
      expect(tokenList[2].type).toBe('characters');
      expect(tokenList[3]).toBe(EOF_TOKEN);
      const textStart: CharactersToken = tokenList[0] as CharactersToken;
      const comment: CommentToken = tokenList[1] as CommentToken;
      const textEnd: CharactersToken = tokenList[2] as CharactersToken;
      expect(textStart.data).toStrictEqual('abc');
      expect(comment.data).toStrictEqual('doc html');
      expect(textEnd.data).toStrictEqual('def');
      expect(errorList).toStrictEqual(['incorrectly-opened-comment']);
    })
  });

  function processInput(input: string) {
    const newInput = new DirectCharacterSource(new Uint16Array(stringToArray(input)));
    // @ts-ignore
    parser.env.input = newInput;
    parser.proceed();
  }

  function expectEqualOrMissing(actual: string | undefined, expected: string | null) {
    if (expected === null)
      expect(actual).toBeUndefined();
    else
      expect(actual).toStrictEqual(expected);
  }
  function createTest(test: TestCase) {
    const [name, input, expectedName, expectedPublicId, expectedSystemId, expectedQuirks, expectedErrors] = test;
    it(name, () => {
      processInput(input);
      expect(parser.state).toStrictEqual('eof');
      expect(tokenList).toHaveLength(2);
      expect(tokenList[1]).toBe(EOF_TOKEN);
      const token: DoctypeToken = tokenList[0] as DoctypeToken;
      expect(token.type).toStrictEqual('doctype');
      expectEqualOrMissing(token.name, expectedName);
      expectEqualOrMissing(token.publicId, expectedPublicId);
      expectEqualOrMissing(token.systemId, expectedSystemId);
      expect(token.forceQuirks).toStrictEqual(expectedQuirks);
      expect(errorList).toStrictEqual(expectedErrors);
    });
  }
}

suite();