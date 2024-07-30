import {Document, Element, NodeType} from '../../decl/xml-lite-decl.js';
import {StaticParentNode} from './StaticParentNode.js';

export class StaticDocument extends StaticParentNode implements Document {
  declare readonly ownerDocument: null;

  constructor() {
    super(NodeType.DOCUMENT_NODE, null);
  }

  get documentElement(): Element {
    return this.children[0];
  }

  getElementById(elementId: string): Element | null {
    return this.collectMatchingElements(el => el.id === elementId)[0] || null;
  }
}