import {NodeType, ProcessingInstruction} from '../../decl/dom-like.js';
import {NodeFactory, NodeTypeMapping} from '../interfaces/NodeFactory.js';
import {TagToken} from '../interfaces/tokens.js';
import {SimpleCDataSection} from './SimpleCDataSection.js';
import {SimpleComment} from './SimpleComment.js';
import {SimpleDocument} from './SimpleDocument.js';
import {SimpleDocumentType} from './SimpleDocumentType.js';
import {SimpleElement} from './SimpleElement.js';
import {SimpleNode} from './SimpleNode.js';
import {SimpleNodeMap} from './SimpleNodeMap.js';
import {SimpleParentNode} from './SimpleParentNode.js';
import {SimpleText} from './SimpleText.js';

export interface SimpleNodeTypeMapping extends NodeTypeMapping {
  CDATASection: SimpleCDataSection;
  Comment: SimpleComment;
  Document: SimpleDocument;
  DocumentType: SimpleDocumentType;
  Element: SimpleElement;
  NamedNodeMap: SimpleNodeMap;
  Node: SimpleNode;
  ParentNode: SimpleParentNode;
  ProcessingInstruction: ProcessingInstruction;
  Text: SimpleText;
}

export class SimpleNodeFactory implements NodeFactory<SimpleNodeTypeMapping> {
  appendElement(parent: SimpleParentNode, node: SimpleElement): void {
    node.nodeIndex = parent.childNodes.push(node) - 1;
    node.elementIndex = parent.children.push(node) - 1;
  }
  appendNode(parent: SimpleParentNode, node: SimpleNode): void {
    node.nodeIndex = parent.childNodes.push(node) - 1;
    node.elementIndex = parent.children.length;
  }
  setDoctype(document: SimpleDocument, doctype: SimpleDocumentType) {
    document.doctype = doctype;
  }
  combineAttributes(element: SimpleElement, token: TagToken): SimpleNodeMap {
    const attributes = element.attributes;
    const otherAttributes = token.attributes;
    const len = otherAttributes.length;
    for (let i = 0; i < len; ++i)
      attributes.addAttribute(element, otherAttributes[i]);
    return attributes;
  }
  createCData(parent: SimpleParentNode, data: string): SimpleCDataSection {
    return new SimpleCDataSection(parent, data);
  }
  createComment(parent: SimpleParentNode, data: string): SimpleComment {
    return new SimpleComment(parent, data);
  }
  createDoctype(parent: SimpleDocument, name: string, publicId: string | undefined, systemId: string | undefined): SimpleDocumentType {
    return new SimpleDocumentType(parent, name, publicId || '', systemId || '');
  }
  createDocument(): SimpleDocument {
    return new SimpleDocument();
  }
  createElement(parent: SimpleParentNode, token: TagToken, namespaceURI: string | null): SimpleElement {
    return new SimpleElement(parent, token, namespaceURI);
  }
  createProcessingInstruction(parent: SimpleParentNode, target: string, data: string): ProcessingInstruction {
    throw new Error('Not implemented');
  }
  createText(parent: SimpleParentNode, data: string): SimpleText {
    return new SimpleText(parent, data);
  }
  insertElement(before: SimpleNode, element: SimpleElement): number {
    const target = before.parentNode!;
    const nodeIndex = this.insertNode(before, element);
    const elementIndex = before.elementIndex;
    target.children.splice(elementIndex, 0, element);
    element.elementIndex = elementIndex;
    const childNodeCount = target.childNodes.length;
    for (let i = nodeIndex + 1; i < childNodeCount; ++i)
      ++target.childNodes[i].elementIndex;
    return elementIndex;
  }
  insertNode(before: SimpleNode, node: SimpleNode): number {
    const target = before.parentNode!;
    const beforeIndex = before.nodeIndex;
    target.childNodes.splice(beforeIndex, 0, node);
    node.nodeIndex = beforeIndex;
    const nodeCount = target.childNodes.length;
    for (let i = beforeIndex; i < nodeCount; ++i)
      target.childNodes[i].nodeIndex = i;
    node.elementIndex = before.elementIndex;
    return beforeIndex;
  }
  relocateNode(target: SimpleParentNode, node: SimpleNode, before?: SimpleNode): void {
    if (node.parentNode !== target) {
      this.removeNode(node);
      node.parentNode = target;
    }
    if (before) {
      if (node.nodeType === NodeType.ELEMENT_NODE)
        this.insertElement(before, node as SimpleElement);
      else
        this.insertNode(before, node);
    } else {
      if (node.nodeType === NodeType.ELEMENT_NODE) {
        this.appendElement(target, node as SimpleElement);
      } else {
        this.appendNode(target, node);
      }
    }
  }
  relocateChildNodes(target: SimpleParentNode, parent: SimpleParentNode): void {
    if (target === parent) return;
    const srcNodes = parent.childNodes;
    const srcNodeCount = srcNodes.length;
    if (!srcNodeCount) return;
    for (let i = 0; i < srcNodeCount; ++i) {
      const node = srcNodes[i];
      if (node.nodeType === NodeType.ELEMENT_NODE)
        this.appendElement(target, node as SimpleElement);
      else
        this.appendNode(target, node);
      node.parentNode = target;
    }
    srcNodes.length = parent.children.length = 0;
  }
  removeNode(node: SimpleNode): void {
    const nodeIndex = node.nodeIndex;
    const parent = node.parentNode;
    if (!parent || nodeIndex < 0) return;
    const childNodes = parent.childNodes;
    const len = childNodes.length;
    if (nodeIndex === len - 1) {
      childNodes.pop();
      if (node.nodeType === NodeType.ELEMENT_NODE)
        parent.children.pop();
    } else {
      childNodes.splice(nodeIndex, 1);
      if (node.nodeType === NodeType.ELEMENT_NODE) {
        const element = node as SimpleElement;
        const children = parent.children;
        if (element.elementIndex === children.length - 1)
          children.pop();
        else
          children.splice(element.elementIndex, 1);
        for (let i = nodeIndex; i < len; ++i) {
          childNodes[i].nodeIndex = i;
          childNodes[i].elementIndex--;
        }
      } else {
        for (let i = nodeIndex; i < len; ++i)
          childNodes[i].nodeIndex = i;
      }
    }
  }
}