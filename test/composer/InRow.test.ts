import {BodyContentSuite, DefaultRawTest} from './abstract-suite';
import {default as rawTests} from './samples/in-row.json';

class InRowSuite extends BodyContentSuite {
  constructor(testCases: DefaultRawTest[]) {
    super(testCases);
  }

  createSuite() {
    super.createSuite();
    describe('end tags', () => {
      const tags = ['body', 'caption', 'col', 'colgroup', 'html', 'td', 'th'];
      for (let endTag of tags) {
        this.createTest(this.prepareTest([
          endTag,
          `<table><thead><tr><td>A</td></${endTag}></tr></thead></table>`,
          '<table><thead><tr><td>A</td></tr></thead></table>',
          ['unexpected-end-tag-in-row']
        ]));
      }
    });
  }
}

const suite = new InRowSuite(rawTests as DefaultRawTest[]);

beforeAll(() => suite.beforeAll());
beforeEach(() => suite.beforeEach());
describe('In row mode', () => suite.createSuite());
