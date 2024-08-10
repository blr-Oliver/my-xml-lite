export const enum NodeType {
  ELEMENT_NODE = 1,
  ATTRIBUTE_NODE = 2,
  TEXT_NODE = 3,
  CDATA_SECTION_NODE = 4,
  PROCESSING_INSTRUCTION_NODE = 7,
  COMMENT_NODE = 8,
  DOCUMENT_NODE = 9,
  DOCUMENT_TYPE_NODE = 10,
  DOCUMENT_FRAGMENT_NODE = 11
}

export const enum DocumentPosition {
  DISCONNECTED = 1 << 0,
  PRECEDING = 1 << 1,
  FOLLOWING = 1 << 2,
  CONTAINS = 1 << 3,
  CONTAINED_BY = 1 << 4,
  IMPLEMENTATION_SPECIFIC = 1 << 5
}

export interface Node {
  readonly ownerDocument: Document | null;
  readonly childNodes: NodeListOf<ChildNode>;
  readonly firstChild: ChildNode | null;
  readonly lastChild: ChildNode | null;
  readonly previousSibling: ChildNode | null;
  readonly nextSibling: ChildNode | null;
  readonly nodeName: string;
  readonly nodeType: NodeType;
  readonly nodeValue: string | null;
  readonly parentElement: Element | null;
  readonly parentNode: ParentNode | null;
  readonly textContent: string | null;
  compareDocumentPosition(other: Node): number;
  contains(other: Node | null): boolean;
  hasChildNodes(): boolean;
  // isEqualNode(otherNode: Node | null): boolean;
  isSameNode(otherNode: Node | null): boolean;
  // lookupNamespaceURI(prefix: string | null): string | null;
  // lookupPrefix(namespace: string | null): string | null;
  normalize(): void;
}

export interface ChildNode extends Node {
}

export interface ParentNode extends Node {
  readonly childElementCount: number;
  readonly children: HTMLCollection;
  readonly firstElementChild: Element | null;
  readonly lastElementChild: Element | null;
  querySelector(selectors: string): Element | null;
  querySelectorAll(selectors: string): NodeListOf<Element>;
}

export interface Element extends ChildNode, NonDocumentTypeChildNode, ParentNode {
  readonly ownerDocument: Document;
  readonly attributes: NamedNodeMap;
  readonly id: string;
  readonly className: string;
  readonly classList: DOMTokenList;
  readonly namespaceURI: string | null;
  readonly prefix: string | null;
  readonly localName: string;
  readonly tagName: string;
  readonly selfClosed?: boolean;
  closest(selectors: string): Element | null;
  getAttribute(qualifiedName: string): string | null;
  getAttributeNS(namespace: string | null, localName: string): string | null;
  getAttributeNames(): ReadonlyArray<string>;
  getAttributeNode(qualifiedName: string): Attr | null;
  getAttributeNodeNS(namespace: string | null, localName: string): Attr | null;
  getElementsByClassName(classNames: string): HTMLCollection;
  getElementsByTagName(qualifiedName: string): HTMLCollection;
  getElementsByTagNameNS(namespace: string | null, localName: string): HTMLCollection;
  hasAttribute(qualifiedName: string): boolean;
  hasAttributeNS(namespace: string | null, localName: string): boolean;
  hasAttributes(): boolean;
  matches(selectors: string): boolean;
}

export interface TemplateElement extends Element {
  readonly content: DocumentFragment;
}

export interface Document extends Node, NonElementParentNode, ParentNode {
  readonly ownerDocument: null;
  readonly doctype: DocumentType | null;
  readonly documentElement: Element;
  readonly head: Element;
  readonly body: Element;
  readonly compatMode: string;
  readonly contentType: string;
  // readonly title: string;
  // createNodeIterator(root: Node, whatToShow?: number, filter?: NodeFilter | null): NodeIterator;
  // createTreeWalker(root: Node, whatToShow?: number, filter?: NodeFilter | null): TreeWalker;
  getElementsByClassName(classNames: string): HTMLCollection;
  getElementsByName(elementName: string): NodeListOf<Element>;
  getElementsByTagName(qualifiedName: string): HTMLCollection;
  getElementsByTagNameNS(namespace: string | null, localName: string): HTMLCollection;
}

export interface CharacterData extends Node, ChildNode, NonDocumentTypeChildNode {
  readonly ownerDocument: Document;
  readonly data: string;
  readonly length: number;
}

export interface Text extends CharacterData {
}

export interface CDATASection extends Text {
}

export interface Comment extends CharacterData {
}

export interface ProcessingInstruction extends CharacterData {
  readonly target: string;
}

export interface DocumentType extends Node, ChildNode {
  readonly ownerDocument: Document;
  readonly name: string;
  readonly publicId: string;
  readonly systemId: string;
}

export interface DocumentFragment extends Node, NonElementParentNode, ParentNode {
  readonly ownerDocument: Document;
}

export interface NonElementParentNode {
  getElementById(elementId: string): Element | null;
}

export interface NonDocumentTypeChildNode {
  readonly nextElementSibling: Element | null;
  readonly previousElementSibling: Element | null;
}

export interface DOMTokenList {
  readonly length: number;
  readonly value: string;
  toString(): string;
  contains(token: string): boolean;
  item(index: number): string | null;
  forEach(callback: (value: string, key: number, parent: DOMTokenList) => void, thisArg?: any): void;
  readonly [index: number]: string;
  [Symbol.iterator](): IterableIterator<string>;
  entries(): IterableIterator<[number, string]>;
  keys(): IterableIterator<number>;
  values(): IterableIterator<string>;
}

export interface Attr extends Node {
  readonly ownerDocument: Document;
  readonly ownerElement: Element | null;
  readonly localName: string;
  readonly name: string;
  readonly namespaceURI: string | null;
  readonly prefix: string | null;
  readonly value: string | null;
}

export interface NodeListOf<TNode extends Node> {
  readonly length: number;
  readonly [index: number]: TNode;
  item(index: number): TNode | null;
  forEach(callback: (value: TNode, key: number, parent: NodeListOf<TNode>) => void, thisArg?: any): void;
  [Symbol.iterator](): IterableIterator<TNode>;
  entries(): IterableIterator<[number, TNode]>;
  keys(): IterableIterator<number>;
  values(): IterableIterator<TNode>;
}

export interface HTMLCollection {
  readonly length: number;
  readonly [index: number]: Element;
  item(index: number): Element | null;
  [Symbol.iterator](): IterableIterator<Element>;
}

export interface NamedNodeMap {
  readonly length: number;
  getNamedItem(qualifiedName: string): Attr | null;
  getNamedItemNS(namespace: string | null, localName: string): Attr | null;
  item(index: number): Attr | null;
  readonly [index: number]: Attr;
  [Symbol.iterator](): IterableIterator<Attr>;
}

export interface NodeFilter {
  acceptNode(node: Node): number;
}

export interface NodeIterator {
  readonly filter: NodeFilter | null;
  readonly pointerBeforeReferenceNode: boolean;
  readonly referenceNode: Node;
  readonly root: Node;
  readonly whatToShow: number;
  nextNode(): Node | null;
  previousNode(): Node | null;
}

export interface TreeWalker {
  currentNode: Node;
  readonly filter: NodeFilter | null;
  readonly root: Node;
  readonly whatToShow: number;
  firstChild(): Node | null;
  lastChild(): Node | null;
  nextNode(): Node | null;
  nextSibling(): Node | null;
  parentNode(): Node | null;
  previousNode(): Node | null;
  previousSibling(): Node | null;
}
