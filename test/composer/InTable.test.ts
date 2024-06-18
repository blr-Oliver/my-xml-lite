import {serialize} from '../../src/impl/Serializer';
import {DefaultRawTest, DefaultSuite, DefaultTestCase} from './abstract-suite';
import {default as rawTests} from './samples/in-table.json';

class InTableSuite extends DefaultSuite {
  constructor(testCases: DefaultRawTest[]) {
    super(testCases);
  }

  runChecks(test: DefaultTestCase) {
    const {output: expectedOutput, errors: expectedErrors} = test;
    expect(this.tokenizer.state).toStrictEqual('eof');
    const document = this.composer.document;
    expect(document).toBeDefined();
    const output = serialize(document);
    expect(output).toStrictEqual('<html><head></head><body>' + expectedOutput + '</body></html>');
    expect(this.errorList.length).toBeGreaterThanOrEqual(1);
    expect(this.errorList[0]).toStrictEqual('missing-doctype');
    expect(this.errorList.slice(1)).toStrictEqual(expectedErrors);
  }
}

const suite = new InTableSuite(rawTests as DefaultRawTest[]);

beforeAll(() => suite.beforeAll());
beforeEach(() => suite.beforeEach());
describe('In table mode', () => suite.createSuite());
