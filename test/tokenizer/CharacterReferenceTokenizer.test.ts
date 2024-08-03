import {State} from '../../src/impl/interfaces/states.js';
import {default as rawTests} from './samples/char-ref.json';
import {DefaultTokenizerRawTestCore, DefaultTokenizerTestCase, DefaultTokenizerTestSuite} from './TokenizerTestSuite.js';

type CharacterReferenceRawTest = [...DefaultTokenizerRawTestCore, number?];

interface CharacterReferenceTestCase extends DefaultTokenizerTestCase {
  refStart?: number;
}

class CharacterReferenceTokenizerTest extends DefaultTokenizerTestSuite<CharacterReferenceRawTest, CharacterReferenceTestCase> {
  prepareTest(rawTest: CharacterReferenceRawTest): CharacterReferenceTestCase {
    const testCase: CharacterReferenceTestCase = {
      name: rawTest[0],
      input: rawTest[1],
      output: rawTest[2],
      errors: rawTest[3],
      lastState: rawTest[4] as State || 'data',
      refStart: rawTest[5] || 0
    };
    return testCase;
  }

  runChecks(test: CharacterReferenceTestCase) {
    super.runChecks(test);
    expect(this.tokenizer.referenceStartMark).toStrictEqual(test.refStart);
  }
}

const suite = new CharacterReferenceTokenizerTest('CharacterReferenceTokenizer tests', rawTests as CharacterReferenceRawTest[]);

describe(suite.name, () => suite.makeSuite());