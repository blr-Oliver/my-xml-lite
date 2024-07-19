import {stringToArray} from '../../src/common/code-sequences';
import {DirectCharacterSource} from '../../src/common/stream-source';
import {HTML_SPECIAL} from '../../src/decl/known-named-refs';
import {ParserEnvironment} from '../../src/decl/ParserEnvironment';
import {buildIndex} from '../../src/impl/build-index';
import {CompositeComposer} from '../../src/impl/composite-composer';
import {FixedSizeStringBuilder} from '../../src/impl/FixedSizeStringBuilder';
import {serialize} from '../../src/impl/Serializer';
import {StateBasedTokenizer} from '../../src/impl/StateBasedTokenizer';

export interface TestCase {
  name: string;
}

export abstract class AbstractSuite<R, T extends TestCase, C extends CompositeComposer> {
  testCases: R[];
  errorList: string[];
  tokenizer!: StateBasedTokenizer;
  composer!: C;

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
    this.composer.formattingArk = {};
    this.composer.formattingZones = [];
    this.composer.pendingTableCharacters = [];

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

export type DefaultRawTestCore = [string/*name*/, string/*input*/, string/*output*/, string[]/*errors*/];
export type DefaultRawTest = [...DefaultRawTestCore, ...any[]];

export class DefaultSuite<R = DefaultRawTest, T extends DefaultTestCase = DefaultTestCase, C extends CompositeComposer = CompositeComposer> extends AbstractSuite<R, T, C> {
  constructor(testCases: R[]) {
    super(testCases);
  }

  createComposer(): C {
    return new CompositeComposer() as C;
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

export class ExcerptSuite<R extends DefaultRawTest = DefaultRawTest, T extends DefaultTestCase = DefaultTestCase, C extends CompositeComposer = CompositeComposer> extends DefaultSuite<R, T, C> {
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

export class BodyContentSuite extends ExcerptSuite {
  constructor(testCases: DefaultRawTest[]) {
    super(testCases, {
      prefixOutput: '<html><head></head><body>',
      suffixOutput: '</body></html>',
      prefixErrors: ['missing-doctype']
    });
  }
}