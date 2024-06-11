import {AfterBodyComposer} from '../../src/impl/composer/AfterBodyComposer';
import {BaseComposer} from '../../src/impl/composer/BaseComposer';
import {BeforeHeadComposer} from '../../src/impl/composer/BeforeHeadComposer';
import {HeadComposer} from '../../src/impl/composer/HeadComposer';
import {InBodyComposer} from '../../src/impl/composer/InBodyComposer';
import {TokenAdjustingComposer} from '../../src/impl/composer/TokenAdjustingComposer';
import {Token} from '../../src/impl/tokens';
import {Class, combine} from '../common/multi-class';
import {AbstractComposer, DefaultSuite, DefaultTestCase} from './abstract-suite';
import {default as rawTests} from './samples/initial.json';

type ModeRawTest = [string/*name*/, string/*input*/, string/*output*/, string/*mode*/, string[]/*errors*/];
type InitialComposer = BaseComposer & TokenAdjustingComposer & BeforeHeadComposer & HeadComposer & InBodyComposer & AfterBodyComposer;

interface FinalModeTest extends DefaultTestCase {
  mode: string;
}

// TODO consider errors
class InitialModeSuite extends DefaultSuite<InitialComposer, ModeRawTest, FinalModeTest> {
  constructor(testCases: ModeRawTest[]) {
    super(testCases);
  }

  createComposer(baseClass: Class<AbstractComposer>): InitialComposer {
    const TestComposer = combine('TestComposer', baseClass,
        BeforeHeadComposer as Class<BeforeHeadComposer>,
        HeadComposer as Class<HeadComposer>,
        InBodyComposer as Class<InBodyComposer>,
        AfterBodyComposer as Class<AfterBodyComposer>
    );

    class IgnoreEOFComposer extends TestComposer {
      accept(token: Token) {
        if (token.type !== 'eof')
          super.accept(token);
      }
    }

    return new IgnoreEOFComposer();
  }

  prepareTest(rawTest: ModeRawTest): FinalModeTest {
    const [name, input, output, mode, errors] = rawTest;
    return {name, input, output, mode, errors};
  }

  runTest(test: FinalModeTest) {
    super.runTest(test);
  }

  runChecks(test: FinalModeTest) {
    super.runChecks(test);
    expect(this.composer.insertionMode).toStrictEqual(test.mode);
  }
}

const suite = new InitialModeSuite(rawTests as ModeRawTest[]);

beforeAll(() => suite.beforeAll());
beforeEach(() => suite.beforeEach());
describe('Initial mode', () => suite.createSuite());
