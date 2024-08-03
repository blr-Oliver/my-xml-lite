import {HTML_SPECIAL} from '../../src/decl/known-named-refs.js';
import {buildIndex} from '../../src/impl/build-index.js';
import {StringCharacterSource} from '../../src/impl/input/StringCharacterSource.js';
import {State} from '../../src/impl/interfaces/states.js';
import {Token} from '../../src/impl/interfaces/tokens.js';
import {Tokenizer} from '../../src/impl/Tokenizer.js';
import {TokenListSink} from './TokenListSink.js';

export interface GenericTestCase {
  name: string;
  input: string;
  output: string[];
  errors: string[];
  lastState?: string;
}

export class LastStateTrackingTokenizer extends Tokenizer {
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

export abstract class TokenizerTestSuite<Raw, Case extends GenericTestCase = GenericTestCase, Subj extends LastStateTrackingTokenizer = LastStateTrackingTokenizer> {
  readonly name: string;
  rawTests: Raw[];
  preparedTests!: Case[];

  tokenizer!: Subj;
  tokenList: Token[] = [];
  errorList: string[] = [];
  lastState!: State;

  protected constructor(name: string, rawTests: Raw[]) {
    this.name = name;
    this.rawTests = rawTests;
  }

  beforeAll() {
    this.tokenizer = this.createTokenizer();
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
    return new LastStateTrackingTokenizer(this) as Subj;
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

    describe(this.name, () => {
      for (let test of this.preparedTests)
        it(test.name, () => this.runTest(test));
    });
  }
}