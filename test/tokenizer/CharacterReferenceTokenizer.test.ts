import {State} from '../../src/impl/interfaces/states.js';
import {default as rawTests} from './samples/char-ref.json';
import {DefaultTokenizerRawTestCore, DefaultTokenizerTestCase, DefaultTokenizerTestSuite} from './TokenizerTestSuite.js';

type CharacterReferenceRawTest = [...DefaultTokenizerRawTestCore, boolean, number?, State?];

interface CharacterReferenceTestCase extends DefaultTokenizerTestCase {
  inAttribute: boolean;
  refStart?: number;
}

class CharacterReferenceTokenizerTest extends DefaultTokenizerTestSuite<CharacterReferenceRawTest, CharacterReferenceTestCase> {
  beforeEach() {
    super.beforeEach();
    this.tokenizer.referenceStartMark = 0;
  }

  prepareTest(rawTest: CharacterReferenceRawTest): CharacterReferenceTestCase {
    const testCase: CharacterReferenceTestCase = {
      name: rawTest[0],
      input: rawTest[1],
      output: rawTest[2],
      errors: rawTest[3],
      inAttribute: rawTest[4],
      refStart: rawTest[5] || 0
    };
    if (rawTest[6])
      testCase.lastState = rawTest[6] as State;
    return testCase;
  }

  runChecks(test: CharacterReferenceTestCase) {
    super.runChecks(test);
    expect(this.tokenizer.referenceStartMark).toStrictEqual(test.refStart);
  }
}

const suite = new CharacterReferenceTokenizerTest('CharacterReferenceTokenizer tests', rawTests as CharacterReferenceRawTest[]);

describe(suite.name, () => suite.makeSuite());