export namespace XMLLite {
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

  export type NodeList<T extends Node> = ArrayLike<T>;

  export interface Node {
    readonly childNodes: NodeList<Node>;
    readonly firstChild: Node | null;
    readonly lastChild: Node | null;
    readonly nextSibling: Node | null;
    readonly previousSibling: Node | null;
    readonly parentNode: Node | null;
    readonly parentElement: Element | null;
    readonly nodeType: NodeType;
    readonly nodeValue: string | null;
    hasChildNodes(): boolean;
  }

  export interface ParentNode extends Node {
    readonly children: NodeList<Element>;
    readonly firstElementChild: Element | null;
    readonly lastElementChild: Element | null;
    getElementsByTagName(name: string): NodeList<Element>;
    getElementsByClassName(classes: string): NodeList<Element>;
  }

  export interface Element extends ParentNode {
    readonly id: string;
    readonly className: string;
    readonly classList: StringList;
    readonly nextElementSibling: Element | null;
    readonly previousElementSibling: Element | null;
    readonly localName: string;
    readonly tagName: string;
    readonly prefix: string | null;
    getAttribute(qName: string): string | null;
    getAttributeNames(): string[];
    hasAttribute(qName: string): boolean;
    hasAttributes(): boolean;
    readonly selfClosed?: boolean;
  }

  export interface CharacterData extends Node {
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
    readonly name: string;
    readonly publicId?: string;
    readonly systemId?: string;
  }

  export interface Document extends ParentNode {
    readonly documentElement: Element;
  }

  export interface StringList {
    readonly length: number;
    contains(string: string): boolean;
    readonly [index: number]: string;
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
}
