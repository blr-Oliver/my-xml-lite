import {CDATASection, Comment, Document, DocumentType, Element, NamedNodeMap, Node, ParentNode, ProcessingInstruction, Text} from '../../decl/dom-like.js';
import {TagToken} from './tokens.js';

export interface NodeTypeMapping {
  CDATASection: CDATASection;
  Comment: Comment;
  Document: Document;
  DocumentType: DocumentType;
  Element: Element;
  NamedNodeMap: NamedNodeMap;
  Node: Node;
  ParentNode: ParentNode;
  ProcessingInstruction: ProcessingInstruction;
  Text: Text;
}

export interface NodeFactory<T extends NodeTypeMapping = NodeTypeMapping> {
  createElement(parent: T['ParentNode'], token: TagToken, namespaceURI: string | null): T['Element'];
  createText(parent: T['ParentNode'], data: string): T['Text'];
  createCData(parent: T['ParentNode'], data: string): T['CDATASection'];
  createProcessingInstruction(parent: T['ParentNode'], target: string, data: string): T['ProcessingInstruction'];
  createComment(parent: T['ParentNode'], data: string): T['Comment'];
  createDocument(): T['Document'];
  createDoctype(parent: T['Document'], name: string, publicId: string | undefined, systemId: string | undefined): T['DocumentType'];
  combineAttributes(element: T['Element'], token: TagToken): void;

  appendNode(parent: T['ParentNode'], node: T['Node']): void;
  appendElement(parent: T['ParentNode'], node: T['Element']): void;
  setDoctype(document: T['Document'], doctype: T['DocumentType'] | null): void;
  insertNode(before: T['Node'], node: T['Node']): void;
  insertElement(before: T['Node'], element: T['Element']): void;
  relocateNode(target: T['ParentNode'], node: T['Node'], before?: T['Node']): void;
  relocateChildNodes(target: T['ParentNode'], parent: T['ParentNode']): void;
  removeNode(node: T['Node']): void;
}