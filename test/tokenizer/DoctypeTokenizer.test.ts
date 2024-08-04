import {DoctypeToken} from '../../src/impl/interfaces/tokens.js';
import {default as rawTests} from './samples/doctype.json';
import {DefaultTokenizerRawTestCore, DefaultTokenizerTestCase, DefaultTokenizerTestSuite} from './TokenizerTestSuite.js';

type DoctypeRawTest = [...DefaultTokenizerRawTestCore, string | null/*doctype name*/, string | null/*public id*/, string | null/*system id*/, boolean/*force quirks*/]

interface DoctypeTestCase extends DefaultTokenizerTestCase {
  doctypeName: string | null;
  publicId: string | null;
  systemId: string | null;
  forceQuirks: boolean;
}

class DoctypeTokenizerTest extends DefaultTokenizerTestSuite<DoctypeRawTest, DoctypeTestCase> {
  expectEqualOrMissing(actual: string | undefined, expected: string | null) {
    if (expected === null)
      expect(actual).toBeUndefined();
    else
      expect(actual).toStrictEqual(expected);
  }

  prepareTest(rawTest: DoctypeRawTest): DoctypeTestCase {
    const result = super.prepareTest(rawTest);
    result.doctypeName = rawTest[5];
    result.publicId = rawTest[6];
    result.systemId = rawTest[7];
    result.forceQuirks = rawTest[8];
    return result;
  }

  runChecks(test: DoctypeTestCase) {
    super.runChecks(test);
    const token = this.tokenList.find(token => token.type === 'doctype') as DoctypeToken;
    if (!token) {
      expect(test.doctypeName).toBeNull();
      expect(test.publicId).toBeNull();
      expect(test.systemId).toBeNull();
      expect(test.forceQuirks).toStrictEqual(true);
    } else {
      this.expectEqualOrMissing(token.name, test.doctypeName);
      this.expectEqualOrMissing(token.publicId, test.publicId);
      this.expectEqualOrMissing(token.systemId, test.systemId);
      expect(token.forceQuirks).toStrictEqual(test.forceQuirks);
    }
  }
}

const suite = new DoctypeTokenizerTest('DoctypeTokenizer tests', rawTests as DoctypeRawTest[]);

describe(suite.name, () => suite.makeSuite());