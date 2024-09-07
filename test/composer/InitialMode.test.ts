import {InsertionMode} from '../../src/impl/interfaces/insertion-mode.js';
import {Token, TokenType} from '../../src/impl/interfaces/tokens.js';
import {SimpleNodeFactory} from '../../src/impl/simple-tree/SimpleNodeFactory.js';
import {TreeComposer} from '../../src/impl/TreeComposer.js';
import {ErrorHandler} from '../../src/interfaces/ErrorHandler.js';
import {InsertionModeReadableString, InsertionModeStringReversed} from '../insertion-mode-strings.js';
import {trackProperty} from '../util/property-tracker.js';
import {DefaultRawTestCore, DefaultSuite, DefaultTestCase} from './abstract-suite.js';
import {initial} from './samples/index.js';

type ModeTrackingRawTest = [...DefaultRawTestCore, InsertionModeReadableString[]/*modes*/];

interface ModeTrackingTestCase extends DefaultTestCase {
  modes: InsertionModeReadableString[];
}

class InitialModeSuite extends DefaultSuite<ModeTrackingRawTest, ModeTrackingTestCase> {
  modes!: InsertionMode[];

  constructor(testCases: ModeTrackingRawTest[]) {
    super('Initial mode', testCases);
  }

  createComposer(): TreeComposer {
    return new class SwallowEOF extends TreeComposer {
      constructor(errorTracker: ErrorHandler) {
        super(new SimpleNodeFactory(), errorTracker);
      }
      accept(token: Token) {
        if (token.type !== TokenType.EOF)
          super.accept(token);
      }
    }(this.errorHandler);
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

  runChecks(test: ModeTrackingTestCase) {
    super.runChecks(test);
    expect(this.modes).toStrictEqual(test.modes.map(mode => InsertionModeStringReversed[mode]));
  }
}

const suite = new InitialModeSuite(initial as ModeTrackingRawTest[]);

describe(suite.name, () => suite.createSuite());
