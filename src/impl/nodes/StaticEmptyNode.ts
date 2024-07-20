import {Node, NodeType} from '../../decl/xml-lite-decl';
import {StaticDocument} from './StaticDocument';
import {StaticElement} from './StaticElement';
import {StaticParentNode} from './StaticParentNode';

const EMPTY_LIST: StaticEmptyNode[] = [] as const;

export abstract class StaticEmptyNode {
  readonly ownerDocument: StaticDocument | null;
  readonly nodeType: NodeType;
  readonly parentNode: StaticParentNode | null;
  readonly parentElement: StaticElement | null;
  readonly childNodes: StaticEmptyNode[];

  parentIndex: number;

  protected constructor(nodeType: NodeType,
                        parentNode: StaticParentNode | null,
                        childNodes: StaticEmptyNode[] = EMPTY_LIST) {
    this.ownerDocument = parentNode ? parentNode.ownerDocument || (parentNode as StaticDocument) : null;
    this.nodeType = nodeType;
    this.parentNode = parentNode;
    this.parentElement = parentNode && parentNode.nodeType === NodeType.ELEMENT_NODE ? parentNode as StaticElement : null;
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