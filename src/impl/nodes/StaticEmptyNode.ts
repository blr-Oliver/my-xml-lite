import {Document, Element, Node, NodeType, ParentNode} from '../../decl/xml-lite-decl';

const EMPTY_LIST: Node[] = [] as const;

export abstract class StaticEmptyNode {
  readonly ownerDocument: Document | null;
  readonly nodeType: NodeType;
  readonly parentNode: ParentNode | null;
  readonly parentElement: Element | null;
  readonly childNodes: Node[];

  parentIndex: number;

  protected constructor(nodeType: NodeType,
                        parentNode: ParentNode | null,
                        childNodes: Node[] = EMPTY_LIST) {
    this.ownerDocument = parentNode ? parentNode.ownerDocument || (parentNode as Document) : null;
    this.nodeType = nodeType;
    this.parentNode = parentNode;
    this.parentElement = parentNode && parentNode.nodeType === NodeType.ELEMENT_NODE ? parentNode as Element : null;
    this.childNodes = childNodes;
    this.parentIndex = parentNode ? parentNode.childNodes.length : -1;
  }
  get nodeValue(): string | null {
    return null;
  }
  get nextSibling(): Node | null {
    return this.parentNode ? this.parentNode.childNodes[this.parentIndex + 1] || null : null;
  }
  get previousSibling(): Node | null {
    return this.parentNode ? this.parentNode.childNodes[this.parentIndex - 1] || null : null;
  }
  get firstChild(): Node | null {
    return null;
  }
  get lastChild(): Node | null {
    return null;
  }
  hasChildNodes(): boolean {
    return false;
  }
}