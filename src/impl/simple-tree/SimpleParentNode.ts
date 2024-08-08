import {NodeType, ParentNode} from '../../interfaces/dom-types.js';
import {SimpleElement} from './SimpleElement.js';
import {SimpleNode} from './SimpleNode.js';
import {SimpleNodeList} from './SimpleNodeList.js';

export abstract class SimpleParentNode extends SimpleNode implements ParentNode {
  children: SimpleNodeList<SimpleElement>;

  protected constructor(nodeType: NodeType, parent: SimpleParentNode | null) {
    super(nodeType, parent);
    this.children = new SimpleNodeList<SimpleElement>(0);
  }
  get nodeValue(): string | null {
    return null;
  }
  get firstElementChild(): SimpleElement | null {
    return this.children[0] || null;
  }
  get lastElementChild(): SimpleElement | null {
    return this.children[this.children.length - 1] || null;
  }
  get childElementCount(): number {
    return this.children.length;
  }
}