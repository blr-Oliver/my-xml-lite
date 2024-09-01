import {StateEnum, StateStringEnum, StateStringReversedEnum} from '../../src/impl/interfaces/states.js';
import {CharactersToken, Token, TokenType} from '../../src/impl/interfaces/tokens.js';
import {TestSerializer} from '../../src/impl/Serializer.js';
import {Tokenizer} from '../../src/impl/Tokenizer.js';
import {buildIndex} from '../../src/impl/util/build-index.js';
import {HTML_SPECIAL} from '../../src/interfaces/named-character-refs.js';
import {InterlacedStringCharacterSource} from '../util/InterlacedStringCharacterSource.js';
import {TokenListSink} from './TokenListSink.js';

export interface GenericTestCase {
  name: string;
  input: string;
}

export type DefaultTokenizerRawTestCore = [string, string, string[], string[], StateStringEnum?];
export type DefaultTokenizerRawTest = [...DefaultTokenizerRawTestCore, ...any[]];

export interface DefaultTokenizerTestCase extends GenericTestCase {
  output: string[];
  errors: string[];
  lastState?: StateStringEnum;
}

export class StateTrackingTokenizer extends Tokenizer {
  readonly suite: TokenizerTestSuite<unknown>;
  declare input: InterlacedStringCharacterSource;

  constructor(suite: TokenizerTestSuite<unknown>) {
    super(buildIndex(HTML_SPECIAL), name => suite.errorList.push(name));
    this.suite = suite;
    this.input = new InterlacedStringCharacterSource(2, '');
  }

  eof(): StateEnum {
    this.suite.lastState = this.state;
    return super.eof();
  }
}

export abstract class TokenizerTestSuite<Raw, Case extends GenericTestCase = GenericTestCase, Subj extends StateTrackingTokenizer = StateTrackingTokenizer> {
  readonly name: string;
  rawTests: Raw[];
  preparedTests!: Case[];

  tokenizer!: Subj;
  tokenList: Token[] = [];
  errorList: string[] = [];
  lastState!: StateEnum;

  constructor(name: string, rawTests: Raw[]) {
    this.name = name;
    this.rawTests = rawTests;
  }

  beforeAll() {
    this.tokenizer = this.createTokenizer();
    this.configure();
  }

  configure() {
    this.tokenizer.composer = new TokenListSink(this.tokenList);
  }

  beforeEach() {
    this.tokenizer.reset();
    this.tokenizer.whitespaceMode = 'mixed';
    this.tokenList.length = 0;
    this.errorList.length = 0;
  }

  createTokenizer(): Subj {
    return new StateTrackingTokenizer(this) as Subj;
  }

  prepareTests() {
    this.preparedTests = this.rawTests.map(rawTest => this.prepareTest(rawTest));
  }

  abstract prepareTest(rawTest: Raw): Case;
  abstract runChecks(test: Case): void;

  runTest(test: Case) {
    this.processInput(test);
    this.runChecks(test);
  }

  processInput(test: Case) {
    this.tokenizer.input.source = test.input;
    while (this.tokenizer.active)
      this.tokenizer.proceed();
  }

  makeSuite() {
    beforeAll(() => this.beforeAll());
    beforeEach(() => this.beforeEach());

    this.prepareTests();

    for (let test of this.preparedTests)
      it(test.name, () => this.runTest(test));
  }
}

export class DefaultTokenizerTestSuite<Raw extends DefaultTokenizerRawTest = DefaultTokenizerRawTest,
    Case extends DefaultTokenizerTestCase = DefaultTokenizerTestCase,
    Subj extends StateTrackingTokenizer = StateTrackingTokenizer>
    extends TokenizerTestSuite<Raw, Case, Subj> {

  prepareTest(rawTest: Raw): Case {
    const testCase = {
      name: rawTest[0],
      input: rawTest[1],
      output: rawTest[2],
      errors: rawTest[3]
    } as DefaultTokenizerTestCase;
    if (rawTest[4])
      testCase.lastState = rawTest[4] as StateStringEnum;
    return testCase as Case;
  }

  serializeTokens(tokenList: Token[]): string[] {
    const result: string[] = [];
    for (let token of tokenList) {
      let type: TokenType | 'whitespace' = token.type;
      if (type === 'characters' && (token as CharactersToken).whitespaceOnly)
        type = 'whitespace';
      const content = TestSerializer.serializeToken(token);
      if (content !== null)
        result.push(`${type}|${content}`);
      else
        result.push(type);
    }
    return result;
  }

  runChecks(test: Case): void {
    const actualTokens = this.serializeTokens(this.tokenList);
    expect(actualTokens).toStrictEqual(test.output);
    expect(this.errorList).toStrictEqual(test.errors);
    if (test.lastState)
      expect(StateStringReversedEnum[this.lastState]).toStrictEqual(test.lastState);
  }
}