import nwsapi from 'nwsapi';
import {Element, NodeListOf, NodeType, ParentNode} from '../../interfaces/dom-types.js';
import {SimpleElement} from './SimpleElement.js';
import {SimpleNode} from './SimpleNode.js';
import {SimpleNodeList} from './SimpleNodeList.js';

export abstract class SimpleParentNode extends SimpleNode implements ParentNode {
  children: SimpleNodeList<SimpleElement>;

  protected constructor(nodeType: NodeType, parent: SimpleParentNode | null) {
    super(nodeType, parent);
    this.children = new SimpleNodeList<SimpleElement>(0);
  }
  get nwsapi(): nwsapi.NWSAPI {
    return this.ownerDocument!.nwsapi;
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
  querySelector(selectors: string): Element | null {
    return this.nwsapi.first(selectors, this as any) as Element | null;
  }
  querySelectorAll(selectors: string): NodeListOf<Element> {
    const elements = this.nwsapi.select(selectors, this as any);
    const len = elements.length;
    const result = new SimpleNodeList<Element>(len);
    for (let i = 0; i < len; ++i)
      result[i] = elements[i] as Element;
    return result;
  }
}