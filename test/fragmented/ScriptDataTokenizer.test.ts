import {EOF, stringToArray} from '../../src/common/code-points';
import {DirectCharacterSource} from '../../src/common/stream-source';
import {ParserEnvironment} from '../../src/decl/ParserEnvironment';
import {FixedSizeStringBuilder} from '../../src/impl/FixedSizeStringBuilder';
import {BaseTokenizer} from '../../src/impl/fragmented/BaseTokenizer';
import {CompleteTokenizer} from '../../src/impl/fragmented/CompleteTokenizer';
import {ScriptDataTokenizer} from '../../src/impl/fragmented/ScriptDataTokenizer';
import {SequenceMatcher} from '../../src/impl/fragmented/SequenceMatcher';
import {State} from '../../src/impl/states';
import {TagTokenizer} from '../../src/impl/fragmented/TagTokenizer';
import {TextTokenizer} from '../../src/impl/fragmented/TextTokenizer';
import {CharactersToken, EOF_TOKEN, TagToken, Token} from '../../src/impl/tokens';
import {Class, combine} from './common/multi-class';
import {default as rawTests} from './samples/script-data.json';

type TestCase = [string/*name*/, string/*input*/, string/*comment data*/, string[]/*errors*/, boolean/*completed*/];
const testCases = rawTests as TestCase[];

function suite() {
  let parser!: ScriptDataTokenizer;
  let tokenList: Token[] = [];
  let errorList: string[] = [];
  let lastState!: State;

  beforeAll(() => {
    const SyntheticScriptDataTokenizer = combine(
        'SyntheticScriptDataTokenizer',
        BaseTokenizer as Class<BaseTokenizer>,
        SequenceMatcher as Class<SequenceMatcher>,
        TagTokenizer as Class<TagTokenizer>,
        TextTokenizer as Class<TextTokenizer>,
        ScriptDataTokenizer as Class<ScriptDataTokenizer>,
        CompleteTokenizer);

    class PartialScriptDataTokenizer extends SyntheticScriptDataTokenizer {
      data(code: number): State {
        if (code === EOF) return this.eof();
        // skip first <script> tag and go straight to interesting part
        const len = '<script>'.length;
        for (let i = 1; i < len; ++i)
          this.nextCode();
        this.startNewTag('script');
        this.emitCurrentTag();
        this.state = 'scriptData';
        return this.scriptData(this.nextCode());
      }
      eof(): State {
        lastState = this.state;
        return super.eof();
      }
    }

    parser = new PartialScriptDataTokenizer();
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