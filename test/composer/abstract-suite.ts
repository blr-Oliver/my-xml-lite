import {stringToArray} from '../../src/common/code-sequences.js';
import {DirectCharacterSource} from '../../src/common/stream-source.js';
import {HTML_SPECIAL} from '../../src/decl/known-named-refs.js';
import {buildIndex} from '../../src/impl/build-index.js';
import {FixedSizeStringBuilder} from '../../src/impl/FixedSizeStringBuilder.js';
import {ParserEnvironment} from '../../src/impl/interfaces/ParserEnvironment.js';
import {StaticNodeFactory} from '../../src/impl/nodes/static-factory.js';
import {serialize} from '../../src/impl/Serializer.js';
import {Tokenizer} from '../../src/impl/Tokenizer.js';
import {TreeComposer} from '../../src/impl/TreeComposer.js';

export interface TestCase {
  name: string;
}

export abstract class AbstractSuite<R, T extends TestCase, C extends TreeComposer> {
  testCases: R[];
  errorList: string[];
  tokenizer!: Tokenizer;
  composer!: C;
  preparedTests!: T[];

  protected constructor(testCases: R[]) {
    this.testCases = testCases;
    this.errorList = [];
  }

  beforeAll() {
    this.composer = this.createComposer();
    this.tokenizer = this.createTokenizer();
    this.configure();
  }

  abstract createComposer(): C;

  createTokenizer(): Tokenizer {
    return new Tokenizer(buildIndex(HTML_SPECIAL));
  }

  prepareTests() {
    this.preparedTests = this.testCases.map(rawTest => this.prepareTest(rawTest));
  }

  configure() {
    this.composer.tokenizer = this.tokenizer;
    this.tokenizer.composer = this.composer;

    this.composer.reset();

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
    this.prepareTests();
    for (let test of this.preparedTests) {
      this.createTest(test);
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

export type DefaultRawTestCore = [string/*name*/, string/*input*/, string/*output*/, string[]/*errors*/];
export type DefaultRawTest = [...DefaultRawTestCore, ...any[]];

export class DefaultSuite<R = DefaultRawTest, T extends DefaultTestCase = DefaultTestCase, C extends TreeComposer = TreeComposer> extends AbstractSuite<R, T, C> {
  constructor(testCases: R[]) {
    super(testCases);
  }

  createComposer(): C {
    return new TreeComposer(new StaticNodeFactory()) as unknown as C;
  }

  prepareTest(rawTest: R): T {
    const [name, input, output, errors] = rawTest as DefaultRawTest;
    return {name, input, output, errors} as T;
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

export type ExcerptParams = {
  prefixInput?: string;
  suffixInput?: string;
  prefixOutput?: string;
  suffixOutput?: string;
  prefixErrors?: string[];
  suffixErrors?: string[];
}

export class ExcerptSuite<R extends DefaultRawTest = DefaultRawTest, T extends DefaultTestCase = DefaultTestCase, C extends TreeComposer = TreeComposer> extends DefaultSuite<R, T, C> {
  prefixInput: string;
  suffixInput: string;
  prefixOutput: string;
  suffixOutput: string;
  prefixErrors: string[];
  suffixErrors: string[];

  constructor(testCases: R[], excerpt: ExcerptParams) {
    super(testCases);
    this.prefixInput = excerpt.prefixInput || '';
    this.suffixInput = excerpt.suffixInput || '';
    this.prefixOutput = excerpt.prefixOutput || '';
    this.suffixOutput = excerpt.suffixOutput || '';
    this.prefixErrors = excerpt.prefixErrors || [];
    this.suffixErrors = excerpt.suffixErrors || [];
  }

  prepareTest(rawTest: R): T {
    let result = super.prepareTest(rawTest);
    result.input = `${this.prefixInput}${result.input}${this.suffixInput}`;
    result.output = `${this.prefixOutput}${result.output}${this.suffixOutput}`;
    result.errors.unshift(...this.prefixErrors);
    result.errors.push(...this.suffixErrors);
    return result;
  }
}
