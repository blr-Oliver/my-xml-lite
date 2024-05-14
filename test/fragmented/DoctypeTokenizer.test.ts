import {stringToArray} from '../../src/common/code-points';
import {DirectCharacterSource} from '../../src/common/stream-source';
import {ParserEnvironment} from '../../src/decl/ParserEnvironment';
import {FixedSizeStringBuilder} from '../../src/impl/FixedSizeStringBuilder';
import {BaseTokenizer} from '../../src/impl/fragmented/BaseTokenizer';
import {CompleteTokenizer} from '../../src/impl/fragmented/CompleteTokenizer';
import {DoctypeTokenizer} from '../../src/impl/fragmented/DoctypeTokenizer';
import {SequenceMatcher} from '../../src/impl/fragmented/SequenceMatcher';
import {State} from '../../src/impl/states';
import {TagTokenizer} from '../../src/impl/fragmented/TagTokenizer';
import {CharactersToken, DoctypeToken, EOF_TOKEN, Token} from '../../src/impl/tokens';
import {Class, combine} from './common/multi-class';
import {default as rawTests} from './samples/doctype.json';

type TestCase = [string/*name*/, string/*input*/, string | null/*doctype name*/, string | null/*public id*/, string | null/*system id*/, boolean/*force quirks*/, string[]/*errors*/];
const testCases = rawTests as TestCase[];

function suite() {
  let parser!: DoctypeTokenizer;
  let tokenList: Token[] = [];
  let errorList: string[] = [];
  let lastState!: State;

  beforeAll(() => {
    const SyntheticDoctypeTokenizer = combine(
        'SyntheticDoctypeTokenizer',
        BaseTokenizer as Class<BaseTokenizer>,
        SequenceMatcher as Class<SequenceMatcher>,
        TagTokenizer as Class<TagTokenizer>,
        DoctypeTokenizer as Class<DoctypeTokenizer>,
        CompleteTokenizer as Class<CompleteTokenizer>);

    class PartialDoctypeTokenizer extends SyntheticDoctypeTokenizer {
      eof(): State {
        lastState = this.state;
        return super.eof();
      }
    }

    parser = new PartialDoctypeTokenizer();
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