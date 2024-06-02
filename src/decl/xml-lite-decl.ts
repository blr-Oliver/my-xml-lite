export enum NodeType {
  ELEMENT_NODE = 1,
  TEXT_NODE = 3,
  CDATA_SECTION_NODE = 4,
  PROCESSING_INSTRUCTION_NODE = 7,
  COMMENT_NODE = 8,
  DOCUMENT_NODE = 9,
  DOCUMENT_TYPE_NODE = 10,
  DOCUMENT_FRAGMENT_NODE = 11
}

export type NodeListOf<T extends Node> = ArrayLike<T> & {
  entries(): IterableIterator<[number, T]>;
  keys(): IterableIterator<number>;
  values(): IterableIterator<T>;
};

export interface Node {
  readonly ownerDocument: Document | null;
  readonly childNodes: NodeListOf<Node>;
  readonly firstChild: Node | null;
  readonly lastChild: Node | null;
  readonly nextSibling: Node | null;
  readonly previousSibling: Node | null;
  readonly parentNode: ParentNode | null;
  readonly parentElement: Element | null;
  readonly nodeType: NodeType;
  readonly nodeValue: string | null;
  hasChildNodes(): boolean;
}

export interface ParentNode extends Node {
  readonly childElementCount: number;
  readonly children: NodeListOf<Element>;
  readonly firstElementChild: Element | null;
  readonly lastElementChild: Element | null;
  getElementsByTagName(name: string): NodeListOf<Element>;
  getElementsByClassName(classes: string): NodeListOf<Element>;
  getElementsByTagNameNS(namespaceURI: string | null, localName: string): NodeListOf<Element>;
}

export interface Element extends ParentNode {
  readonly ownerDocument: Document;
  readonly attributes: NamedNodeMap;
  readonly id: string;
  readonly className: string;
  readonly classList: StringList;
  readonly nextElementSibling: Element | null;
  readonly previousElementSibling: Element | null;
  readonly namespaceURI: string | null;
  readonly prefix: string | null;
  readonly localName: string;
  readonly tagName: string;
  getAttribute(qName: string): string | null;
  getAttributeNS(prefix: string | null, localName: string): string | null;
  getAttributeNames(): string[];
  getAttributeNode(qualifiedName: string): Attr | null;
  getAttributeNodeNS(namespace: string | null, localName: string): Attr | null;
  hasAttribute(qName: string): boolean;
  hasAttributeNS(prefix: string | null, localName: string): boolean;
  hasAttributes(): boolean;
  readonly selfClosed?: boolean;
}

export interface CharacterData extends Node {
  readonly ownerDocument: Document;
  readonly data: string;
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

export interface DocumentType extends Node {
  readonly ownerDocument: Document;
  readonly name: string;
  readonly publicId: string;
  readonly systemId: string;
}

export interface Document extends ParentNode {
  readonly ownerDocument: null;
  readonly documentElement: Element;
  getElementById(elementId: string): Element | null;
}

export interface StringList {
  readonly length: number;
  contains(string: string): boolean;
  readonly [index: number]: string;
  [Symbol.iterator](): IterableIterator<string>;
}

export interface Attr {
  readonly localName: string;
  readonly name: string;
  readonly namespaceURI: string | null;
  readonly ownerDocument: Document;
  readonly ownerElement: Element;
  readonly prefix: string | null;
  readonly value: string | null;
}

export interface NamedNodeMap {
  readonly length: number;
  getNamedItem(qualifiedName: string): Attr | null;
  getNamedItemNS(namespace: string | null, localName: string): Attr | null;
  item(index: number): Attr | null;
  readonly [index: number]: Attr;
  [Symbol.iterator](): IterableIterator<Attr>;
}

export function isElement(node: Node): node is Element {
  return node.nodeType === NodeType.ELEMENT_NODE;
}

export function isText(node: Node): node is Text {
  return node.nodeType === NodeType.TEXT_NODE || isCDATA(node);
}

export function isCDATA(node: Node): node is CDATASection {
  return node.nodeType === NodeType.CDATA_SECTION_NODE;
}

export function isComment(node: Node): node is Comment {
  return node.nodeType === NodeType.COMMENT_NODE;
}

export function isProcessingInstruction(node: Node): node is ProcessingInstruction {
  return node.nodeType === NodeType.PROCESSING_INSTRUCTION_NODE;
}

export function isDocumentType(node: Node): node is DocumentType {
  return node.nodeType === NodeType.DOCUMENT_TYPE_NODE;
}

export function isDocument(node: Node): node is Document {
  return node.nodeType === NodeType.DOCUMENT_NODE;
}

export function isParentNode(node: Node): node is ParentNode {
  return isElement(node) || isDocument(node) || node.nodeType === NodeType.DOCUMENT_FRAGMENT_NODE;
}
