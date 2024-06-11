import {stringToArray} from '../../src/common/code-sequences';
import {DirectCharacterSource} from '../../src/common/stream-source';
import {HTML_SPECIAL} from '../../src/decl/known-named-refs';
import {ParserEnvironment} from '../../src/decl/ParserEnvironment';
import {buildIndex} from '../../src/impl/build-index';
import {BaseComposer} from '../../src/impl/composer/BaseComposer';
import {BeforeHeadComposer} from '../../src/impl/composer/BeforeHeadComposer';
import {HeadComposer} from '../../src/impl/composer/HeadComposer';
import {InBodyComposer} from '../../src/impl/composer/InBodyComposer';
import {TokenAdjustingComposer} from '../../src/impl/composer/TokenAdjustingComposer';
import {FixedSizeStringBuilder} from '../../src/impl/FixedSizeStringBuilder';
import {serialize} from '../../src/impl/Serializer';
import {StateBasedTokenizer} from '../../src/impl/StateBasedTokenizer';
import {Class, combine} from '../common/multi-class';

export type Composer = BaseComposer & TokenAdjustingComposer & HeadComposer & BeforeHeadComposer & InBodyComposer;

export interface TestCase {
  name: string;
}

export abstract class AbstractSuite<R, T extends TestCase> {
  testCases: R[];
  errorList: string[];
  tokenizer!: StateBasedTokenizer;
  composer!: Composer;

  protected constructor(testCases: R[]) {
    this.testCases = testCases;
    this.errorList = [];
  }

  beforeAll() {
    const TestComposer = combine('TestComposer',
        BaseComposer as Class<BaseComposer>,
        TokenAdjustingComposer as Class<TokenAdjustingComposer>,
        BeforeHeadComposer as Class<BeforeHeadComposer>,
        HeadComposer as Class<HeadComposer>,
        InBodyComposer as Class<InBodyComposer>
    );

    this.composer = this.createComposer(TestComposer);
    this.tokenizer = this.createTokenizer();
    this.configure();
  }

  createComposer(baseClass: Class<Composer>): Composer {
    return new baseClass();
  }

  createTokenizer(): StateBasedTokenizer {
    return new StateBasedTokenizer(buildIndex(HTML_SPECIAL));
  }

  configure() {
    this.composer.tokenizer = this.tokenizer;
    this.tokenizer.composer = this.composer;

    this.composer.templateInsertionModes = [];
    this.composer.openElements = [];
    this.composer.openCounts = {};
    this.composer.fosterTables = new Map<any, any>();
    this.composer.formattingElements = [];

    this.tokenizer.env = {
      buffer: new FixedSizeStringBuilder(1000),
      tokens: this.composer,
      errors: this.errorList
    } as unknown as ParserEnvironment;
  }

  beforeEach() {
    this.tokenizer.active = true;
    this.tokenizer.env.buffer.clear();
    this.errorList.length = 0;
    this.composer.reset();
  }

  abstract prepareTest(rawTest: R): T;
  abstract runTest(test: T): void;

  createSuite() {
    for (let test of this.testCases) {
      this.createTest(this.prepareTest(test));
    }
  }

  createTest(test: T) {
    it(test.name, () => this.runTest(test));
  }
}

export interface DefaultTestCase extends TestCase {
  input: string;
  output: string;
  errors: string[];
}

export abstract class DefaultSuite<R, T extends DefaultTestCase = DefaultTestCase> extends AbstractSuite<R, T> {
  protected constructor(testCases: R[]) {
    super(testCases);
  }

  createSource(input: string) {
    return new DirectCharacterSource(new Int32Array(stringToArray(input)));
  }

  processInput(test: T) {
    const source = this.createSource(test.input);
    // @ts-ignore
    this.tokenizer.env.input = source;
    this.tokenizer.proceed();
  }

  runTest(test: T) {
    this.processInput(test);
    this.runChecks(test);
  }

  runChecks(test: T) {
    const {output: expectedOutput, errors: expectedErrors} = test;
    expect(this.tokenizer.state).toStrictEqual('eof');
    const document = this.composer.document;
    expect(document).toBeDefined();
    const output = serialize(document);
    expect(output).toStrictEqual(expectedOutput);
    expect(this.errorList).toStrictEqual(expectedErrors);
  }
}
