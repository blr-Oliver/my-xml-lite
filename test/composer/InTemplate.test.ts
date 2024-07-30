import {InsertionMode} from '../../src/impl/interfaces/insertion-mode.js';
import {DefaultRawTestCore, DefaultTestCase, ExcerptSuite} from './abstract-suite.js';
import {inTemplate} from './samples/index.js';

type InsertionModeChange = `${'+' | '-'}${InsertionMode}`;
type TemplateRawTest = [...DefaultRawTestCore, InsertionModeChange[]?];

interface TemplateTestCase extends DefaultTestCase {
  templateModeChanges?: InsertionModeChange[];
}

class InTemplateSuite extends ExcerptSuite<TemplateRawTest, TemplateTestCase> {
  templateModeChanges: InsertionModeChange[] = [];

  constructor(rawTests: TemplateRawTest[]) {
    super(rawTests, {
      prefixInput: '<html><head></head><body>',
      prefixOutput: '<html><head></head><body>',
      suffixOutput: '</body></html>',
      prefixErrors: ['missing-doctype']
    });
  }

  configure() {
    super.configure();
    this.composer.templateInsertionModes.push = (...args: InsertionMode[]) => {
      this.templateModeChanges.push(...args.map(value => `+${value}` as InsertionModeChange));
      return Array.prototype.push.call(this.composer.templateInsertionModes, ...args);
    }
    this.composer.templateInsertionModes.pop = () => {
      const value = Array.prototype.pop.call(this.composer.templateInsertionModes);
      this.templateModeChanges.push(`-${value}` as InsertionModeChange);
      return value;
    }
  }

  prepareTest(rawTest: TemplateRawTest): TemplateTestCase {
    const result = super.prepareTest(rawTest);
    if (rawTest[4]) result.templateModeChanges = rawTest[4];
    return result;
  }

  beforeEach() {
    super.beforeEach();
    this.templateModeChanges.length = 0;
  }

  runChecks(test: TemplateTestCase) {
    super.runChecks(test);
    if (test.templateModeChanges)
      expect(this.templateModeChanges).toStrictEqual(test.templateModeChanges);
  }
}

const suite = new InTemplateSuite(inTemplate as TemplateRawTest[]);

beforeAll(() => suite.beforeAll());
beforeEach(() => suite.beforeEach());
describe('In template mode', () => suite.createSuite());
