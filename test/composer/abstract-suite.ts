import {ChildNode, Document, Element, Node, NodeType, NonDocumentTypeChildNode, ParentNode} from '../../src/decl/dom-like.js';
import {HTML_SPECIAL} from '../../src/decl/known-named-refs.js';
import {buildIndex} from '../../src/impl/build-index.js';
import {ErrorHandler} from '../../src/impl/interfaces/error-tracker.js';
import {serialize} from '../../src/impl/Serializer.js';
import {SimpleNodeFactory} from '../../src/impl/simple-tree/SimpleNodeFactory.js';
import {Tokenizer} from '../../src/impl/Tokenizer.js';
import {TreeComposer} from '../../src/impl/TreeComposer.js';
import {InterlacedStringCharacterSource} from '../util/InterlacedStringCharacterSource.js';

export interface TestCase {
  name: string;
}

export abstract class AbstractSuite<R, T extends TestCase, C extends TreeComposer> {
  testCases: R[];
  errorList: string[];
  tokenizer!: Tokenizer;
  composer!: C;
  preparedTests!: T[];
  errorHandler!: ErrorHandler;
  input: InterlacedStringCharacterSource;
  readonly name: string;

  protected constructor(name: string, testCases: R[]) {
    this.name = name;
    this.testCases = testCases;
    this.errorList = [];
    this.input = new InterlacedStringCharacterSource(2, '');
  }

  beforeAll() {
    this.errorHandler = error => this.errorList.push(error);
    this.composer = this.createComposer();
    this.tokenizer = this.createTokenizer();
    this.configure();
  }

  abstract createComposer(): C;

  createTokenizer(): Tokenizer {
    return new Tokenizer(buildIndex(HTML_SPECIAL), this.errorHandler);
  }

  prepareTests() {
    this.preparedTests = this.testCases.map(rawTest => this.prepareTest(rawTest));
  }

  configure() {
    this.composer.tokenizer = this.tokenizer;
    this.tokenizer.composer = this.composer;
    this.tokenizer.input = this.input;
    this.composer.reset();
  }

  beforeEach() {
    this.tokenizer.reset();
    this.composer.reset();
    this.errorList.length = 0;
  }

  abstract prepareTest(rawTest: R): T;
  abstract runTest(test: T): void;

  createSuite() {
    beforeAll(() => this.beforeAll());
    beforeEach(() => this.beforeEach());

    this.prepareTests();
    for (let test of this.preparedTests) {
      this.createTest(test);
    }
  }

  createTest(test: T) {
    it(test.name, () => this.runTest(test));
  }
}

export interface DefaultTestCase extends TestCase {
  input: string;
  output: string;
  errors: string[];
}

export type DefaultRawTestCore = [string/*name*/, string/*input*/, string/*output*/, string[]/*errors*/];
export type DefaultRawTest = [...DefaultRawTestCore, ...any[]];

export class DefaultSuite<R = DefaultRawTest, T extends DefaultTestCase = DefaultTestCase, C extends TreeComposer = TreeComposer> extends AbstractSuite<R, T, C> {
  constructor(name: string, testCases: R[]) {
    super(name, testCases);
  }

  createComposer(): C {
    return new TreeComposer(new SimpleNodeFactory(), this.errorHandler) as unknown as C;
  }

  prepareTest(rawTest: R): T {
    const [name, input, output, errors] = rawTest as DefaultRawTest;
    return {name, input, output, errors} as T;
  }

  processInput(test: T) {
    this.input.source = test.input;
    while (this.tokenizer.active)
      this.tokenizer.proceed();
  }

  runTest(test: T) {
    this.processInput(test);
    this.runChecks(test);
  }

  runChecks(test: T) {
    const {output: expectedOutput, errors: expectedErrors} = test;
    expect(this.tokenizer.state).toStrictEqual('eof');
    const document = this.composer.document;
    expect(document).toBeDefined();
    const output = serialize(document);
    expect(output).toStrictEqual(expectedOutput);
    expect(this.errorList).toStrictEqual(expectedErrors);
    this.validateTree(document);
  }

  validateTree(document: Document) {
    expect(document).toBeDefined();
    expect(document.nodeType).toStrictEqual(NodeType.DOCUMENT_NODE);
    expect(document.parentNode).toStrictEqual(null);
    this.validateNode(document);
  }

  validateNode(parent: ParentNode) {
    const count = parent.childNodes.length;
    if (!count) return;
    let previousNode: Node | null = null;
    let previousElement: Element | null = null;
    let elementCount: number = 0;
    for (let i = 0; i < count; ++i) {
      const currentNode = parent.childNodes[i];
      expect(currentNode.parentNode).toBe(parent);
      expect(currentNode.previousSibling).toBe(previousNode);
      if (previousNode)
        expect(previousNode.nextSibling).toBe(currentNode);
      if (currentNode.nodeType === NodeType.DOCUMENT_TYPE_NODE) {
        expect(parent.nodeType).toStrictEqual(NodeType.DOCUMENT_NODE);
        expect((parent as Document).doctype).toBe(currentNode);
      } else {
        const currentChild = currentNode as (NonDocumentTypeChildNode & ChildNode);
        expect(currentChild.previousElementSibling).toBe(previousElement);
        if (currentNode.nodeType === NodeType.ELEMENT_NODE) {
          const currentElement = currentChild as Element;
          expect(parent.children[elementCount++]).toBe(currentElement);
          if (previousElement)
            expect(previousElement.nextElementSibling).toBe(currentElement);
          previousElement = currentElement;
          this.validateNode(currentElement);
        }
      }
      previousNode = currentNode;
    }
    expect(parent.children.length).toStrictEqual(elementCount);
  }
}
