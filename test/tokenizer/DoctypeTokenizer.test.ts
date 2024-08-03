import {stringToArray} from '../../src/common/code-sequences.js';
import {DirectCharacterSource} from '../../src/common/stream-source.js';
import {HTML_SPECIAL} from '../../src/decl/known-named-refs.js';
import {buildIndex} from '../../src/impl/build-index.js';
import {State} from '../../src/impl/interfaces/states.js';
import {CharactersToken, CommentToken, DoctypeToken, EOF_TOKEN, Token} from '../../src/impl/interfaces/tokens.js';
import {Tokenizer} from '../../src/impl/Tokenizer.js';
import {default as rawTests} from './samples/doctype.json';
import {TokenListSink} from './TokenListSink.js';

type TestCase = [string/*name*/, string/*input*/, string | null/*doctype name*/, string | null/*public id*/, string | null/*system id*/, boolean/*force quirks*/, string[]/*errors*/];
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
    parser.composer = new TokenListSink(tokenList);
    parser.tokenQueue = [];
  });

  beforeEach(() => {
    parser.reset();
    parser.whitespaceMode = 'mixed';
    tokenList.length = 0;
    errorList.length = 0;
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
    parser.input = newInput;
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