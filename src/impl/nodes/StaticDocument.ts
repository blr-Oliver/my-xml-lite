import {Document, Element, NodeType} from '../../decl/xml-lite-decl';
import {StaticElement} from './StaticElement';
import {StaticEmptyNode} from './StaticEmptyNode';
import {StaticParentNode} from './StaticParentNode';

export class StaticDocument extends StaticParentNode implements Document {
  declare readonly ownerDocument: null;

  constructor(childNodes: StaticEmptyNode[], children?: StaticElement[]) {
    super(NodeType.DOCUMENT_NODE, null, childNodes, children);
  }

  get documentElement(): Element {
    return this.children[0];
  }

  getElementById(elementId: string): Element | null {
    return this.collectMatchingElements(el => el.id === elementId)[0] || null;
  }
}