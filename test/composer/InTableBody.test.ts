import {DefaultRawTest, ExcerptSuite} from './abstract-suite';
import {default as rawTests} from './samples/in-table-body.json';

class InTableBodySuite extends ExcerptSuite {
  constructor(testCases: DefaultRawTest[]) {
    super(testCases, {
      prefixInput: '<!DOCTYPE html>',
      prefixOutput: '<!DOCTYPE html><html><head></head><body>',
      suffixOutput: '</body></html>'
    });
  }

  createSuite() {
    super.createSuite();
    describe('end tags', () => {
      const tags = ['body', 'caption', 'col', 'colgroup', 'html', 'td', 'th', 'tr'];
      for (let endTag of tags) {
        this.createTest(this.prepareTest([
          endTag,
          `<table><tbody></${endTag}><tr></tr></tbody></table>`,
          '<table><tbody><tr></tr></tbody></table>',
          ['unexpected-end-tag-in-table-body']
        ]));
      }
    });
  }
}

const suite = new InTableBodySuite(rawTests as DefaultRawTest[]);

beforeAll(() => suite.beforeAll());
beforeEach(() => suite.beforeEach());
describe('In table body mode', () => suite.createSuite());
