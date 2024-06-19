import {BodyContentSuite, DefaultRawTest} from './abstract-suite';
import {default as rawTests} from './samples/in-cell.json';

class InCellSuite extends BodyContentSuite {
  constructor(testCases: DefaultRawTest[]) {
    super(testCases);
  }

  createSuite() {
    super.createSuite();
    describe('end tags', () => {
      const tags = ['body', 'caption', 'col', 'colgroup', 'html'];
      for (let endTag of tags) {
        this.createTest(this.prepareTest([
          endTag,
          `<table><thead><tr><td>A</${endTag}></td><td>B</td></tr></thead></table>`,
          '<table><thead><tr><td>A</td><td>B</td></tr></thead></table>',
          ['unexpected-end-tag-in-cell']
        ]));
      }
    });
  }
}

const suite = new InCellSuite(rawTests as DefaultRawTest[]);

beforeAll(() => suite.beforeAll());
beforeEach(() => suite.beforeEach());
describe('In cell mode', () => suite.createSuite());
