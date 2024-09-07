import {InsertionMode} from '../../src/impl/interfaces/insertion-mode.js';
import {InsertionModeReadableString, InsertionModeStringReversed} from '../insertion-mode-strings.js';
import {DefaultRawTestCore, DefaultSuite, DefaultTestCase} from './abstract-suite.js';
import {inTemplate} from './samples/index.js';

type InsertionModeChange = `${'+' | '-'}${InsertionModeReadableString}`;
type TemplateRawTest = [...DefaultRawTestCore, InsertionModeChange[]];

interface TemplateTestCase extends DefaultTestCase {
  templateModeChanges: InsertionModeChange[];
}

class InTemplateSuite extends DefaultSuite<TemplateRawTest, TemplateTestCase> {
  templateModeChanges: InsertionModeChange[] = [];

  constructor(rawTests: TemplateRawTest[]) {
    super('In template mode', rawTests);
  }

  configure() {
    super.configure();
    this.composer.templateInsertionModes.push = (...args: InsertionMode[]) => {
      this.templateModeChanges.push(...args.map(value => `+${InsertionModeStringReversed[value]}` as InsertionModeChange));
      return Array.prototype.push.call(this.composer.templateInsertionModes, ...args);
    }
    this.composer.templateInsertionModes.pop = () => {
      const value = Array.prototype.pop.call(this.composer.templateInsertionModes) as InsertionMode;
      this.templateModeChanges.push(`-${InsertionModeStringReversed[value]}` as InsertionModeChange);
      return value;
    }
  }

  prepareTest(rawTest: TemplateRawTest): TemplateTestCase {
    const result = super.prepareTest(rawTest);
    result.templateModeChanges = rawTest[4];
    return result;
  }

  beforeEach() {
    super.beforeEach();
    this.templateModeChanges.length = 0;
  }

  runChecks(test: TemplateTestCase) {
    super.runChecks(test);
    expect(this.templateModeChanges).toStrictEqual(test.templateModeChanges);
  }
}

const suite = new InTemplateSuite(inTemplate as TemplateRawTest[]);

describe(suite.name, () => suite.createSuite());
