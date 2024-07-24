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

export interface StaticNodeTypeMapping extends NodeTypeMapping {
  CDATASection: StaticDataNode;
  Comment: StaticDataNode;
  Document: StaticDocument;
  DocumentType: StaticDocumentType;
  Element: StaticElement;
  NamedNodeMap: StaticAttributes;
  Node: StaticEmptyNode;
  ParentNode: StaticParentNode;
  Text: StaticDataNode;
}

export class StaticNodeFactory implements NodeFactory<StaticNodeTypeMapping> {
  createElement(parent: StaticParentNode, token: TagToken, namespaceURI: string | null): StaticElement {
    return new StaticElement(token, namespaceURI, parent);
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
  createDocument(): StaticDocument {
    return new StaticDocument();
  }
  createDoctype(parent: StaticDocument, name: string, publicId: string | undefined, systemId: string | undefined): StaticDocumentType {
    return new StaticDocumentType(parent, name, publicId || '', systemId || '');
  }
  combineAttributes(element: StaticElement, token: TagToken): StaticAttributes {
    const attributes = element.attributes;
    const otherAttributes = token.attributes;
    const len = otherAttributes.length;
    for (let i = 0; i < len; ++i) {
      const attrToken = otherAttributes[i];
      if (!attributes.getNamedItem(attrToken.name))
        attributes.addAttributeNode(new StaticAttr(attrToken, element));
    }
    return attributes;
  }

  appendNode(parent: StaticParentNode, node: StaticEmptyNode) {
    parent.childNodes.push(node);
  }

  appendElement(parent: StaticParentNode, element: StaticElement) {
    parent.childNodes.push(element);
    parent.children.push(element);
  }

  insertElement(before: StaticEmptyNode, element: StaticElement): number {
    const target = before.parentNode!;
    const nodeIndex = this.insertNode(before, element);
    let elementIndex: number;
    if (isElement(before))
      elementIndex = (before as StaticElement).parentElementIndex;
    else {
      elementIndex = nodeIndex;
      while (elementIndex > 0) {
        if (isElement(target.childNodes[elementIndex])) {
          elementIndex = (target.childNodes[elementIndex] as StaticElement).parentElementIndex;
          break;
        }
        --elementIndex;
      }
    }
    target.children.splice(elementIndex, 0, element);
    const childrenCount = target.children.length;
    for (let i = elementIndex; i < childrenCount; ++i)
      target.children[i].parentElementIndex = i;
    return elementIndex;
  }

  insertNode(before: StaticEmptyNode, node: StaticEmptyNode): number {
    const target = before.parentNode!;
    let beforeIndex = before.parentIndex;
    target.childNodes.splice(beforeIndex, 0, node);
    const nodeCount = target.childNodes.length;
    for (let i = beforeIndex; i < nodeCount; ++i)
      target.childNodes[i].parentIndex = i;
    return beforeIndex;
  }

  relocateNode(target: StaticParentNode, node: StaticEmptyNode, before?: StaticEmptyNode) {
    if (node.parentNode !== target) {
      this.removeNode(node);
      this.__setParent(node, target);
    }
    if (before) {
      if (isElement(node))
        this.insertElement(before, node as StaticElement);
      else
        this.insertNode(before, node);
    } else {
      node.parentIndex = target.childNodes.length;
      if (isElement(node)) {
        const element = node as StaticElement;
        element.parentElementIndex = target.children.length;
        this.appendElement(target, element);
      } else {
        this.appendNode(target, node);
      }
    }
  }

  relocateChildNodes(target: StaticParentNode, parent: StaticParentNode) {
    if (target === parent) return;
    const childNodes = parent.childNodes.slice();
    // TODO children arrays could be just concatenated
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

  __setParent(node: StaticEmptyNode, parent: StaticParentNode) {
    // @ts-ignore
    node.parentNode = node.parentElement = parent;
  }
}