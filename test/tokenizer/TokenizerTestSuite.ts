import {HTML_SPECIAL} from '../../src/decl/known-named-refs.js';
import {buildIndex} from '../../src/impl/build-index.js';
import {StringCharacterSource} from '../../src/impl/input/StringCharacterSource.js';
import {State} from '../../src/impl/interfaces/states.js';
import {CharactersToken, Token, TokenType} from '../../src/impl/interfaces/tokens.js';
import {serializeToken} from '../../src/impl/Serializer.js';
import {Tokenizer} from '../../src/impl/Tokenizer.js';
import {TokenListSink} from './TokenListSink.js';

export interface GenericTestCase {
  name: string;
  input: string;
}

export type DefaultTokenizerRawTestCore = [string, string, string[], string[]];
export type DefaultTokenizerRawTest = [...DefaultTokenizerRawTestCore, ...any[]];

export interface DefaultTokenizerTestCase extends GenericTestCase {
  output: string[];
  errors: string[];
  lastState?: State;
}

export class StateTrackingTokenizer extends Tokenizer {
  readonly suite: TokenizerTestSuite<unknown>;
  declare input: StringCharacterSource;

  constructor(suite: TokenizerTestSuite<unknown>) {
    super(buildIndex(HTML_SPECIAL), name => suite.errorList.push(name));
    this.suite = suite;
    this.input = new StringCharacterSource('');
  }

  eof(): State {
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
  lastState!: State;

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
    this.tokenizer.tokenQueue = [];
  }

  beforeEach() {
    this.tokenizer.state = 'data';
    this.tokenizer.active = true;
    this.tokenizer.buffer.clear();
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
      testCase.lastState = rawTest[4] as State;
    return testCase as Case;
  }

  serializeTokens(): string[] {
    const result: string[] = [];
    for (let token of this.tokenList) {
      let type: TokenType | 'whitespace' = token.type;
      if (type === 'characters' && (token as CharactersToken).whitespaceOnly)
        type = 'whitespace';
      const content = serializeToken(token);
      if (content !== null)
        result.push(`${type}|${content}`);
      else
        result.push(type);
    }
    return result;
  }

  runChecks(test: Case): void {
    const actualTokens = this.serializeTokens();
    expect(actualTokens).toStrictEqual(test.output);
    expect(this.errorList).toStrictEqual(test.errors);
    if (test.lastState)
      expect(this.lastState).toStrictEqual(test.lastState);
  }
}