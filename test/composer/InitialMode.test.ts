import {Token} from '../../src/impl/tokens';
import {Class} from '../common/multi-class';
import {Composer, DefaultSuite, DefaultTestCase} from './abstract-suite';
import {default as rawTests} from './samples/initial.json';

type ModeRawTest = [string/*name*/, string/*input*/, string/*output*/, string/*mode*/, string[]/*errors*/];

interface FinalModeTest extends DefaultTestCase {
  mode: string;
}

class InitialModeSuite extends DefaultSuite<ModeRawTest, FinalModeTest> {
  constructor(testCases: ModeRawTest[]) {
    super(testCases);
  }

  createComposer(baseClass: Class<Composer>): Composer {
    class IgnoreEOFComposer extends baseClass {
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
