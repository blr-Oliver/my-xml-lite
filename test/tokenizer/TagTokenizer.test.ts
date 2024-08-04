import {TagToken} from '../../src/impl/interfaces/tokens.js';
import {default as rawTests} from './samples/tags.json';
import {DefaultTokenizerRawTestCore, DefaultTokenizerTestCase, DefaultTokenizerTestSuite} from './TokenizerTestSuite.js';

type AttributeData = [string, string | null];
type TagTokenizerRawTest = [...DefaultTokenizerRawTestCore, AttributeData[]];

interface TagTokenizerTestCase extends DefaultTokenizerTestCase {
  attributes: AttributeData[];
}

class TagTokenizerTest extends DefaultTokenizerTestSuite<TagTokenizerRawTest, TagTokenizerTestCase> {
  prepareTest(rawTest: TagTokenizerRawTest): TagTokenizerTestCase {
    const result = super.prepareTest(rawTest);
    result.attributes = rawTest[5];
    return result;
  }

  runChecks(test: TagTokenizerTestCase) {
    super.runChecks(test);
    const tagToken = this.tokenList.find(token => token.type === 'startTag') as TagToken;
    if (test.attributes.length)
      expect(tagToken).toBeDefined();
    if (tagToken) {
      const len = tagToken.attributes.length;
      expect(len).toStrictEqual(test.attributes.length);
      for (let i = 0; i < len; ++i) {
        expect(tagToken.attributes[i].name).toStrictEqual(test.attributes[i][0]);
        expect(tagToken.attributes[i].value).toStrictEqual(test.attributes[i][1]);
      }
    }
  }
}

const suite = new TagTokenizerTest('TagTokenizer tests', rawTests as TagTokenizerRawTest[]);

describe(suite.name, () => suite.makeSuite());