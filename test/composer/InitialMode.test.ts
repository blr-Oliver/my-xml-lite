import {InsertionMode} from '../../src/impl/interfaces/insertion-mode';
import {Token} from '../../src/impl/interfaces/tokens';
import {StaticNodeFactory} from '../../src/impl/nodes/static-factory';
import {TreeComposer} from '../../src/impl/TreeComposer';
import {trackProperty} from '../util/property-tracker';
import {DefaultRawTestCore, DefaultSuite, DefaultTestCase} from './abstract-suite';
import {default as rawTests} from './samples/initial.json';

type ModeTrackingRawTest = [...DefaultRawTestCore, InsertionMode[]/*modes*/];

interface ModeTrackingTestCase extends DefaultTestCase {
  modes: string[];
}

class InitialModeSuite extends DefaultSuite<ModeTrackingRawTest, ModeTrackingTestCase> {
  modes!: InsertionMode[];

  constructor(testCases: ModeTrackingRawTest[]) {
    super(testCases);
  }

  createComposer(): TreeComposer {
    return new class SwallowEOF extends TreeComposer {
      constructor() {
        super(new StaticNodeFactory());
      }
      accept(token: Token) {
        if (token.type !== 'eof')
          super.accept(token);
      }
    }();
  }

  configure() {
    super.configure();
    this.modes = trackProperty(this.composer, 'insertionMode');
  }

  beforeEach() {
    super.beforeEach();
    this.modes.length = 0;
  }

  prepareTest(rawTest: ModeTrackingRawTest): ModeTrackingTestCase {
    const result = super.prepareTest(rawTest);
    result.modes = rawTest[4];
    return result;
  }

  runTest(test: ModeTrackingTestCase) {
    super.runTest(test);
  }

  runChecks(test: ModeTrackingTestCase) {
    super.runChecks(test);
    expect(this.modes).toStrictEqual(test.modes);
  }
}

const suite = new InitialModeSuite(rawTests as ModeTrackingRawTest[]);

beforeAll(() => suite.beforeAll());
beforeEach(() => suite.beforeEach());
describe('Initial mode', () => suite.createSuite());
