import {NodeType, ProcessingInstruction} from '../../decl/xml-lite-decl';
import {NodeFactory, NodeTypeMapping} from '../composer/NodeFactory';
import {TagToken} from '../tokens';
import {StaticAttr} from './StaticAttr';
import {StaticAttributes} from './StaticAttributes';
import {StaticDataNode} from './StaticDataNode';
import {StaticDocument} from './StaticDocument';
import {StaticDocumentType} from './StaticDocumentType';
import {StaticElement} from './StaticElement';
import {StaticEmptyNode} from './StaticEmptyNode';
import {StaticParentNode} from './StaticParentNode';
import {StaticTokenList} from './StaticTokenList';

export interface StaticNodeTypeMapping extends NodeTypeMapping {
  CDATASection: StaticDataNode;
  Comment: StaticDataNode;
  Document: StaticDocument;
  DocumentType: StaticDocumentType;
  DOMTokenList: StaticTokenList;
  Element: StaticElement;
  NamedNodeMap: StaticAttributes;
  Node: StaticEmptyNode;
  ParentNode: StaticParentNode;
  Text: StaticDataNode;
}

export class StaticNodeFactory implements NodeFactory<StaticNodeTypeMapping> {
  createElement(parent: StaticParentNode, token: TagToken, namespaceURI: string | null, attributes: StaticAttributes | null, childNodes: StaticEmptyNode[], children: StaticElement[]): StaticElement {
    return new StaticElement(token, namespaceURI, parent, childNodes, children);
  }
  createText(parent: StaticParentNode, data: string): StaticDataNode {
    return new StaticDataNode(NodeType.TEXT_NODE, parent, data);
  }
  createCData(parent: StaticParentNode, data: string): StaticDataNode {
    return new StaticDataNode(NodeType.CDATA_SECTION_NODE, parent, data);
  }
  createProcessingInstruction(parent: StaticParentNode, target: string, data: string): ProcessingInstruction {
    throw new Error('Not implemented');
  }
  createComment(parent: StaticParentNode, data: string): StaticDataNode {
    return new StaticDataNode(NodeType.COMMENT_NODE, parent, data);
  }
  createDocument(childNodes: StaticEmptyNode[], children: StaticElement[]): StaticDocument {
    return new StaticDocument(childNodes, children);
  }
  createDoctype(parent: StaticDocument, name: string, publicId: string | undefined, systemId: string | undefined): StaticDocumentType {
    return new StaticDocumentType(parent, name, publicId || '', systemId || '');
  }
  createAttributes(token: TagToken): StaticAttributes {
    return new StaticAttributes(token.attributes, null);
  }
  combineAttributes(attributes: StaticAttributes, token: TagToken): StaticAttributes {
    const otherAttributes = token.attributes;
    const len = otherAttributes.length;
    for (let i = 0; i < len; ++i) {
      const attrToken = otherAttributes[i];
      if (!attributes.getNamedItem(attrToken.name))
        attributes.addAttributeNode(new StaticAttr(attrToken, null));
    }
    return attributes;
  }
  createTokenList(value: string): StaticTokenList {
    return new StaticTokenList(value);
  }
}