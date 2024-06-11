import {AfterBodyComposer} from '../../src/impl/composer/AfterBodyComposer';
import {BaseComposer} from '../../src/impl/composer/BaseComposer';
import {BeforeHeadComposer} from '../../src/impl/composer/BeforeHeadComposer';
import {HeadComposer} from '../../src/impl/composer/HeadComposer';
import {InBodyComposer} from '../../src/impl/composer/InBodyComposer';
import {InsertionMode} from '../../src/impl/composer/insertion-mode';
import {TokenAdjustingComposer} from '../../src/impl/composer/TokenAdjustingComposer';
import {Token} from '../../src/impl/tokens';
import {Class, combine} from '../common/multi-class';
import {DefaultSuite, DefaultTestCase} from './abstract-suite';
import {default as rawTests} from './samples/initial.json';

type ModeRawTest = [string/*name*/, string/*input*/, string/*output*/, string/*mode*/, number/*extra*/, string[]/*errors*/];

interface FinalModeTest extends DefaultTestCase {
  mode: string;
  extra: number;
}

const TestComposer = combine('TestComposer',
    BaseComposer as Class<BaseComposer>,
    TokenAdjustingComposer as Class<TokenAdjustingComposer>,
    BeforeHeadComposer as Class<BeforeHeadComposer>,
    HeadComposer as Class<HeadComposer>,
    InBodyComposer as Class<InBodyComposer>,
    AfterBodyComposer as Class<AfterBodyComposer>
);

class SingleModeComposer extends TestComposer {
  readonly focusMode: InsertionMode;
  readonly extraTokens: Token[];

  constructor(focusMode: InsertionMode, extraTokens: Token[]) {
    super();
    this.focusMode = focusMode;
    this.extraTokens = extraTokens;
  }

  process(token: Token): InsertionMode {
    if (token.type === 'eof') return this.insertionMode;
    if (this.insertionMode !== 'initial') {
      this.extraTokens.push(token);
      return this.insertionMode;
    }
    return super.process(token);
  }
}

// TODO consider errors
class InitialModeSuite extends DefaultSuite<SingleModeComposer, ModeRawTest, FinalModeTest> {
  extraTokens: Token[] = [];

  constructor(testCases: ModeRawTest[]) {
    super(testCases);
  }

  createComposer(): SingleModeComposer {
    return new SingleModeComposer('initial', this.extraTokens);
  }

  beforeEach() {
    super.beforeEach();
    this.composer.setInsertionMode(this.composer.focusMode);
    this.extraTokens.length = 0;
  }

  prepareTest(rawTest: ModeRawTest): FinalModeTest {
    const [name, input, output, mode, extra, errors] = rawTest;
    return {name, input, output, mode, extra, errors};
  }

  runTest(test: FinalModeTest) {
    super.runTest(test);
  }

  runChecks(test: FinalModeTest) {
    super.runChecks(test);
    expect(this.composer.insertionMode).toStrictEqual(test.mode);
    expect(this.extraTokens.length).toStrictEqual(test.extra);
  }
}

const suite = new InitialModeSuite(rawTests as ModeRawTest[]);

beforeAll(() => suite.beforeAll());
beforeEach(() => suite.beforeEach());
describe('Initial mode', () => suite.createSuite());
