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
import {default as rawTests} from './samples/basic.json';

type Composer = BaseComposer & TokenAdjustingComposer & InBodyComposer & HeadComposer & InBodyComposer;
type TestCase = [string/*name*/, string/*input*/, string/*output*/, string[]/*errors*/];
const testCases = rawTests as TestCase[];

class Suite {
  testCases: TestCase[];
  errorList: string[];
  tokenizer!: StateBasedTokenizer;
  composer!: Composer;

  constructor(testCases: TestCase[]) {
    this.testCases = testCases;
    this.errorList = [];
  }

  beforeAll() {
    const SyntheticComposer = combine('SyntheticComposer',
        BaseComposer as Class<BaseComposer>,
        TokenAdjustingComposer as Class<TokenAdjustingComposer>,
        BeforeHeadComposer as Class<BeforeHeadComposer>,
        HeadComposer as Class<HeadComposer>,
        InBodyComposer as Class<InBodyComposer>
    );

    class TestComposer extends SyntheticComposer {
      constructor() {
        super();
      }
    }

    this.composer = new TestComposer();
    this.tokenizer = new StateBasedTokenizer(buildIndex(HTML_SPECIAL));
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

  processInput(input: string) {
    const newInput = new DirectCharacterSource(new Uint16Array(stringToArray(input)));
    // @ts-ignore
    this.tokenizer.env.input = newInput;
    this.tokenizer.proceed();
  }

  createTest(test: TestCase) {
    const [name, input, expectedOutput, expectedErrors] = test;
    it(name, () => {
      this.processInput(input);
      expect(this.tokenizer.state).toStrictEqual('eof');
      const document = this.composer.document;
      expect(document).toBeDefined();
      const output = serialize(document);
      expect(output).toStrictEqual(expectedOutput);
      expect(this.errorList).toStrictEqual(expectedErrors);
    });
  }
}

const suite = new Suite(testCases);

beforeAll(() => suite.beforeAll());
beforeEach(() => suite.beforeEach());
describe('Basic tests', () => {
  for (let test of suite.testCases)
    suite.createTest(test);
})
