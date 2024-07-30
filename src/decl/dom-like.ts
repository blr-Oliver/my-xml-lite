interface Node {
  readonly baseURI: string;
  readonly childNodes: NodeListOf<ChildNode>;
  readonly firstChild: ChildNode | null;
  readonly isConnected: boolean;
  readonly lastChild: ChildNode | null;
  readonly nextSibling: ChildNode | null;
  readonly nodeName: string;
  readonly nodeType: number;
  readonly nodeValue: string | null;
  readonly ownerDocument: Document | null;
  readonly parentElement: HTMLElement | null;
  readonly parentNode: ParentNode | null;
  readonly previousSibling: ChildNode | null;
  // textContent: string | null;
  // compareDocumentPosition(other: Node): number;
  // contains(other: Node | null): boolean;
  hasChildNodes(): boolean;
  // isEqualNode(otherNode: Node | null): boolean;
  // isSameNode(otherNode: Node | null): boolean;
  // lookupNamespaceURI(prefix: string | null): string | null;
  // lookupPrefix(namespace: string | null): string | null;
}

interface ChildNode extends Node {
}

interface ParentNode extends Node {
  readonly childElementCount: number;
  readonly children: HTMLCollection;
  readonly firstElementChild: Element | null;
  readonly lastElementChild: Element | null;
  // querySelector<E extends Element = Element>(selectors: string): E | null;
  // querySelectorAll<E extends Element = Element>(selectors: string): NodeListOf<E>;
}

interface Element extends Node, ChildNode, NonDocumentTypeChildNode, ParentNode {
  readonly attributes: NamedNodeMap;
  readonly classList: DOMTokenList;
  readonly className: string;
  readonly id: string;
  readonly innerHTML: string;
  readonly localName: string;
  readonly namespaceURI: string | null;
  readonly outerHTML: string;
  readonly ownerDocument: Document;
  readonly prefix: string | null;
  readonly tagName: string;
  // closest<E extends Element = Element>(selectors: string): E | null;
  getAttribute(qualifiedName: string): string | null;
  getAttributeNS(namespace: string | null, localName: string): string | null;
  getAttributeNames(): string[];
  getAttributeNode(qualifiedName: string): Attr | null;
  getAttributeNodeNS(namespace: string | null, localName: string): Attr | null;
  // getElementsByClassName(classNames: string): HTMLCollectionOf<Element>;
  // getElementsByTagName(qualifiedName: string): HTMLCollectionOf<Element>;
  // getElementsByTagNameNS(namespace: string | null, localName: string): HTMLCollectionOf<Element>;
  hasAttribute(qualifiedName: string): boolean;
  hasAttributeNS(namespace: string | null, localName: string): boolean;
  hasAttributes(): boolean;
  // matches(selectors: string): boolean;
}

interface Document extends Node, NonElementParentNode, ParentNode {
  readonly body: HTMLElement;
  readonly doctype: DocumentType | null;
  readonly documentElement: HTMLElement;
  readonly head: HTMLElement;
  readonly ownerDocument: null;
  readonly title: string;
  // createNodeIterator(root: Node, whatToShow?: number, filter?: NodeFilter | null): NodeIterator;
  // createTreeWalker(root: Node, whatToShow?: number, filter?: NodeFilter | null): TreeWalker;
  // getElementById(elementId: string): HTMLElement | null;
  // getElementsByClassName(classNames: string): HTMLCollectionOf<Element>;
  // getElementsByName(elementName: string): NodeListOf<HTMLElement>;
  // getElementsByTagName(qualifiedName: string): HTMLCollectionOf<Element>;
  // getElementsByTagNameNS(namespace: string | null, localName: string): HTMLCollectionOf<Element>;
}

interface HTMLElement extends Element {
  readonly innerText: string;
  readonly outerText: string;
}

interface DocumentType extends Node, ChildNode {
  readonly name: string;
  readonly ownerDocument: Document;
  readonly publicId: string;
  readonly systemId: string;
}

interface CharacterData extends Node, ChildNode, NonDocumentTypeChildNode {
  readonly data: string;
  readonly length: number;
  readonly ownerDocument: Document;
}

interface Text extends CharacterData {
}

interface CDATASection extends Text {
}

interface Comment extends CharacterData {
}

interface ProcessingInstruction extends CharacterData {
  readonly ownerDocument: Document;
  readonly target: string;
}

interface DocumentFragment extends Node, NonElementParentNode, ParentNode {
  readonly ownerDocument: Document;
  // getElementById(elementId: string): HTMLElement | null;
}

interface NonElementParentNode {
  // getElementById(elementId: string): Element | null;
}

interface NonDocumentTypeChildNode {
  readonly nextElementSibling: Element | null;
  readonly previousElementSibling: Element | null;
}

interface Attr extends Node {
  readonly localName: string;
  readonly name: string;
  readonly namespaceURI: string | null;
  readonly ownerDocument: Document;
  readonly ownerElement: Element | null;
  readonly prefix: string | null;
  readonly value: string;
}

interface NodeList {
  readonly length: number;
  item(index: number): Node | null;
  forEach(callback: (value: Node, key: number, parent: NodeList) => void, thisArg?: any): void;
  readonly [index: number]: Node;
  [Symbol.iterator](): IterableIterator<Node>;
  entries(): IterableIterator<[number, Node]>;
  keys(): IterableIterator<number>;
  values(): IterableIterator<Node>;
}

interface NodeListOf<TNode extends Node> extends NodeList {
  item(index: number): TNode;
  forEach(callback: (value: TNode, key: number, parent: NodeListOf<TNode>) => void, thisArg?: any): void;
  readonly [index: number]: TNode;
  [Symbol.iterator](): IterableIterator<TNode>;
  entries(): IterableIterator<[number, TNode]>;
  keys(): IterableIterator<number>;
  values(): IterableIterator<TNode>;
}

interface HTMLCollectionBase {
  readonly length: number;
  item(index: number): Element | null;
  readonly [index: number]: Element;
  [Symbol.iterator](): IterableIterator<Element>;
}

interface HTMLCollection extends HTMLCollectionBase {
  namedItem(name: string): Element | null;
}

interface HTMLCollectionOf<T extends Element> extends HTMLCollectionBase {
  item(index: number): T | null;
  namedItem(name: string): T | null;
  readonly [index: number]: T;
  [Symbol.iterator](): IterableIterator<T>;
}

interface DOMTokenList {
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

interface NamedNodeMap {
  readonly length: number;
  getNamedItem(qualifiedName: string): Attr | null;
  getNamedItemNS(namespace: string | null, localName: string): Attr | null;
  item(index: number): Attr | null;
  readonly [index: number]: Attr;
  [Symbol.iterator](): IterableIterator<Attr>;
}

interface NodeFilter {
  acceptNode(node: Node): number;
}

interface NodeIterator {
  readonly filter: NodeFilter | null;
  readonly pointerBeforeReferenceNode: boolean;
  readonly referenceNode: Node;
  readonly root: Node;
  readonly whatToShow: number;
  nextNode(): Node | null;
  previousNode(): Node | null;
}

interface TreeWalker {
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