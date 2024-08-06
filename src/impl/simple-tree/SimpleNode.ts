import {Node, NodeType} from '../../decl/dom-like.js';
import {SimpleChildNode} from './SimpleChildNode.js';
import {SimpleDocument} from './SimpleDocument.js';
import {SimpleElement} from './SimpleElement.js';
import {SimpleNodeList} from './SimpleNodeList.js';
import {SimpleParentNode} from './SimpleParentNode.js';

export abstract class SimpleNode implements Node {
  readonly nodeType: NodeType;
  ownerDocument: SimpleDocument | null;
  parentNode: SimpleParentNode | null;
  childNodes: SimpleNodeList<SimpleChildNode>;

  nodeIndex: number;
  elementIndex: number;

  protected constructor(nodeType: NodeType, parent: SimpleParentNode | null) {
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

  hasChildNodes(): boolean {
    return this.childNodes.length !== 0;
  }
}