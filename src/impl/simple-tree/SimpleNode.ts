import {DocumentPosition, Node, NodeType} from '../../interfaces/dom-types.js';
import {SimpleAttr} from './SimpleAttr.js';
import {SimpleChildNode} from './SimpleChildNode.js';
import {SimpleDocument} from './SimpleDocument.js';
import {SimpleElement} from './SimpleElement.js';
import {SimpleNodeList} from './SimpleNodeList.js';
import {SimpleParentNode} from './SimpleParentNode.js';

export abstract class SimpleNode implements Node {
  protected static _id: number = 0;
  readonly _id: number;
  readonly nodeType: NodeType;
  ownerDocument: SimpleDocument | null;
  parentNode: SimpleParentNode | null;
  childNodes: SimpleNodeList<SimpleChildNode>;

  nodeIndex: number;
  elementIndex: number;

  protected constructor(nodeType: NodeType, parent: SimpleParentNode | null) {
    this._id = SimpleNode._id++;
    this.nodeType = nodeType;
    this.parentNode = parent;
    this.ownerDocument = parent?.ownerDocument || (parent as SimpleDocument | null);
    this.childNodes = new SimpleNodeList<SimpleChildNode>(0);
    this.nodeIndex = -1;
    this.elementIndex = -1;
  }

  get parentElement(): SimpleElement | null {
    return this.parentNode?.nodeType === NodeType.ELEMENT_NODE ? this.parentNode as SimpleElement : null;
  }
  get firstChild(): SimpleChildNode | null {
    return this.childNodes[0] || null;
  }
  get lastChild(): SimpleChildNode | null {
    return this.childNodes[this.childNodes.length - 1] || null;
  }
  get previousSibling(): SimpleChildNode | null {
    return this.parentNode?.childNodes[this.nodeIndex - 1] || null;
  }
  get nextSibling(): SimpleChildNode | null {
    return this.parentNode?.childNodes[this.nodeIndex + 1] || null;
  }
  get previousElementSibling(): SimpleElement | null {
    return this.parentNode!.children[this.elementIndex - 1] || null;
  }
  get nextElementSibling(): SimpleElement | null {
    return this.parentNode!.children[this.elementIndex] || null;
  }

  abstract get nodeName(): string;
  abstract get nodeValue(): string | null;
  abstract get textContent(): string | null;

  hasChildNodes(): boolean {
    return this.childNodes.length !== 0;
  }
  compareDocumentPosition(other: SimpleNode): number {
    if (this === other) return 0;
    let node1 = other, node2: SimpleNode = this;
    let attr1: SimpleAttr | null = null, attr2: SimpleAttr | null = null;
    if (node1.nodeType === NodeType.ATTRIBUTE_NODE) {
      attr1 = node1 as SimpleAttr;
      node1 = attr1.ownerElement;
    }
    if (node2.nodeType === NodeType.ATTRIBUTE_NODE) {
      attr2 = node2 as SimpleAttr;
      node2 = attr2.ownerElement;
      if (attr1 !== null && node1 === node2) {
        return DocumentPosition.IMPLEMENTATION_SPECIFIC | (attr1.nodeIndex < attr2.nodeIndex ? DocumentPosition.PRECEDING : DocumentPosition.FOLLOWING);
      }
    }
    const doc1 = node1.ownerDocument || (node1 as SimpleDocument);
    const doc2 = node2.ownerDocument || (node2 as SimpleDocument);
    if (doc1 !== doc2)
      return DocumentPosition.DISCONNECTED | DocumentPosition.IMPLEMENTATION_SPECIFIC | (doc1._id < doc2._id ? DocumentPosition.PRECEDING : DocumentPosition.FOLLOWING);
    if (node1 === node2 && attr2 || !attr1 && node2.isDescendant(node1))
      return DocumentPosition.CONTAINS && DocumentPosition.PRECEDING;
    if (node1 === node2 && attr1 || !attr2 && node1.isDescendant(node2))
      return DocumentPosition.CONTAINED_BY && DocumentPosition.FOLLOWING;
    return node1.isPreceding(node2) ? DocumentPosition.PRECEDING : DocumentPosition.FOLLOWING;
  }
  isDescendant(other: SimpleNode, inclusive: boolean = false): boolean {
    if (other === this) return inclusive;
    let node: SimpleNode | null = this;
    while (node = node.parentNode)
      if (other === node) return true;
    return false;
  }
  isPreceding(other: SimpleNode): boolean {
    const thisRootPath = this.getRootPath();
    const otherRootPath = other.getRootPath();
    let thisDepth = thisRootPath.length, otherDepth = otherRootPath.length;
    while (thisRootPath[--thisDepth] === otherRootPath[--otherDepth])
      ;
    const thisBranch: SimpleNode | undefined = thisRootPath[thisDepth];
    const otherBranch: SimpleNode | undefined = otherRootPath[otherDepth];
    if (!thisBranch) return true;
    if (!otherBranch) return false;
    return thisBranch.nodeIndex < otherBranch.nodeIndex;
  }
  getRootPath(): SimpleNode[] {
    const result: SimpleNode[] = [this];
    let node: SimpleNode | null = this;
    while (node = node.parentNode)
      result.push(node);
    return result;
  }
  isSameNode(otherNode: SimpleNode | null): boolean {
    return this === otherNode;
  }
  // TODO eliminate recursion
  traverseNodes(callback: (node: SimpleNode) => void): void {
    const childNodes = this.childNodes;
    const len = childNodes.length;
    for (let i = 0; i < len; ++i) {
      const childNode = childNodes[i];
      callback(childNode);
      childNode.traverseNodes(callback);
    }
  }
  normalize(): void {
  }
}