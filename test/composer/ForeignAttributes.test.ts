import {NS_XLINK, NS_XML, NS_XMLNS} from '../../src/impl/TreeComposer.js';
import {DefaultRawTest, DefaultTestCase, ExcerptSuite} from './abstract-suite.js';
import {foreignAttributesParams} from './samples/excerpts';
import {foreignAttributes} from './samples/index.js';

const NS_BY_PREFIX: { [prefix: string]: string } = {
  'xlink': NS_XLINK,
  'xml': NS_XML,
  'xmlns': NS_XMLNS
}

class ForeignAttributesTest extends ExcerptSuite {
  constructor(tests: DefaultRawTest[]) {
    super(tests, foreignAttributesParams);
  }

  runChecks(test: DefaultTestCase) {
    super.runChecks(test);
    let prefix: string | null | undefined, localName: string | null | undefined;
    [prefix, localName] = test.name.split(':');
    if (!localName) [prefix, localName] = [null, prefix];
    const svg = this.composer.document.getElementById('test');
    expect(svg).toBeDefined();
    const idAttr = svg!.attributes[0];
    expect(idAttr).toBeDefined();
    expect(idAttr.name).toStrictEqual('id');
    expect(idAttr.value).toStrictEqual('test');
    expect(idAttr.prefix).toBeNull();
    expect(idAttr.localName).toStrictEqual('id');
    expect(idAttr.namespaceURI).toBeNull();
    const subjAttr = svg!.attributes[1];
    expect(subjAttr).toBeDefined();
    expect(subjAttr.name).toStrictEqual(test.name);
    expect(subjAttr.value).toStrictEqual('test');
    expect(subjAttr.prefix).toStrictEqual(prefix);
    expect(subjAttr.localName).toStrictEqual(localName);
    expect(subjAttr.namespaceURI).toStrictEqual(NS_BY_PREFIX[prefix || localName]);
  }
}

const suite = new ForeignAttributesTest(foreignAttributes as DefaultRawTest[]);

beforeAll(() => suite.beforeAll());
beforeEach(() => suite.beforeEach());
describe('Adjusting foreign attributes', () => suite.createSuite());