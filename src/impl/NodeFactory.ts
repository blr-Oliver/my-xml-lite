import {
  CDATASection,
  Comment,
  Document,
  DocumentType,
  DOMTokenList,
  Element,
  NamedNodeMap,
  Node,
  ParentNode,
  ProcessingInstruction,
  Text
} from '../decl/xml-lite-decl';
import {TagToken} from './tokens';

export interface NodeTypeMapping {
  CDATASection: CDATASection;
  Comment: Comment;
  Document: Document;
  DocumentType: DocumentType;
  DOMTokenList: DOMTokenList;
  Element: Element;
  NamedNodeMap: NamedNodeMap;
  Node: Node;
  ParentNode: ParentNode;
  ProcessingInstruction: ProcessingInstruction;
  Text: Text;
}

export interface NodeFactory<T extends NodeTypeMapping = NodeTypeMapping> {
  // TODO restrict null attributes here
  createElement(parent: T['ParentNode'], token: TagToken, namespaceURI: string | null, attributes: T['NamedNodeMap'] | null, childNodes: T['Node'][], children: T['Element'][]): T['Element'];
  createText(parent: T['ParentNode'], data: string): T['Text'];
  createCData(parent: T['ParentNode'], data: string): T['CDATASection'];
  createProcessingInstruction(parent: T['ParentNode'], target: string, data: string): T['ProcessingInstruction'];
  createComment(parent: T['ParentNode'], data: string): T['Comment'];
  createDocument(childNodes: T['Node'][], children: T['Element'][]): T['Document'];
  createDoctype(parent: T['Document'], name: string, publicId: string | undefined, systemId: string | undefined): T['DocumentType'];
  combineAttributes(element: T['Element'], token: TagToken): T['NamedNodeMap'];
  createTokenList(value: string): T['DOMTokenList'];

  appendNode(parent: T['ParentNode'], node: T['Node']): void;
  appendElement(parent: T['ParentNode'], node: T['Element']): void;
  // TODO add insert operation
  setNestedNodes(parent: T['ParentNode'], childNodes: T['Node'][], children: T['Element'][]): void;
  relocateNode(target: T['ParentNode'], node: T['Node'], before?: T['Node']): void;
  relocateChildNodes(target: T['ParentNode'], parent: T['ParentNode']): void;
  removeNode(node: T['Node']): void;
}