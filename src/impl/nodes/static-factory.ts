import {isElement, NodeType, ProcessingInstruction} from '../../decl/xml-lite-decl';
import {NodeFactory, NodeTypeMapping} from '../NodeFactory';
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

  appendNode(parent: StaticParentNode, node: StaticEmptyNode) {
    parent.childNodes.push(node)
  }
  appendElement(parent: StaticParentNode, element: StaticElement) {
    parent.children.push(element);
  }
  setNestedNodes(parent: StaticParentNode, childNodes: StaticEmptyNode[], children: StaticElement[]) {
    //@ts-ignore
    parent.childNodes = childNodes;
    //@ts-ignore
    parent.children = children;
    childNodes.forEach(this.__setNodeIndex, this);
    children.forEach(this.__setElementIndex, this);
  }
  relocateNode(target: StaticParentNode, node: StaticEmptyNode, before?: StaticEmptyNode) {
    if (node.parentNode !== target) {
      this.removeNode(node);
      this.__setParent(node, target);
    }
    if (before) {
      let beforeIndex = before.parentIndex;
      target.childNodes.splice(beforeIndex, 0, node);
      for (let i = beforeIndex; i < target.childNodes.length; ++i)
        target.childNodes[i].parentIndex = i;
      if (isElement(node)) {
        const element = node as StaticElement;
        let beforeElementIndex: number;
        if (isElement(before))
          beforeElementIndex = (before as StaticElement).parentElementIndex;
        else {
          beforeElementIndex = beforeIndex;
          while (beforeElementIndex > 0) {
            if (isElement(target.childNodes[beforeElementIndex])) {
              beforeElementIndex = (target.childNodes[beforeElementIndex] as StaticElement).parentElementIndex;
              break;
            }
            --beforeElementIndex;
          }
        }
        target.children.splice(beforeElementIndex, 0, element);
        for (let i = beforeElementIndex; i < target.children.length; ++i)
          target.children[i].parentElementIndex = i;
      }
    } else {
      node.parentIndex = target.childNodes.length;
      this.appendNode(target, node);
      if (isElement(node)) {
        const element = node as StaticElement;
        element.parentElementIndex = target.children.length;
        this.appendElement(target, element);
      }
    }
  }
  relocateChildNodes(target: StaticParentNode, parent: StaticParentNode) {
    if (target === parent) return;
    const childNodes = parent.childNodes.slice();
    for (let child of childNodes)
      this.relocateNode(target, child);
    parent.childNodes.length = 0;
    parent.children.length = 0;
  }
  removeNode(node: StaticEmptyNode) {
    if (!node.parentNode) return;
    const parent = node.parentNode!;
    const childNodes = parent.childNodes;
    if (node.parentIndex === childNodes.length - 1)
      childNodes.pop();
    else {
      childNodes.splice(node.parentIndex, 1);
      const len = childNodes.length;
      for (let i = node.parentIndex; i < len; ++i)
        childNodes[i].parentIndex = i;
    }
    if (isElement(node)) {
      const element = node as StaticElement;
      const children = parent.children;
      if (element.parentElementIndex === children.length - 1)
        children.pop();
      else {
        children.splice(element.parentElementIndex, 1);
        const len = children.length;
        for (let i = element.parentElementIndex; i < len; ++i)
          children[i].parentElementIndex = i;
      }
    }
  }

  __setNodeIndex(node: StaticEmptyNode, nodeIndex: number) {
    node.parentIndex = nodeIndex;
  }
  __setElementIndex(el: StaticElement, elementIndex: number) {
    el.parentElementIndex = elementIndex;
  }
  __setParent(node: StaticEmptyNode, parent: StaticParentNode) {
    // @ts-ignore
    node.parentNode = node.parentElement = parent;
  }
}