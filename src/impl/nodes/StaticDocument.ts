import {Document, Element, Node, NodeType} from '../../decl/xml-lite-decl';
import {StaticParentNode} from './StaticParentNode';

export class StaticDocument extends StaticParentNode implements Document {
  declare readonly ownerDocument: null;

  constructor(childNodes: Node[], children?: Element[]) {
    super(NodeType.DOCUMENT_NODE, null, childNodes, children);
  }

  get documentElement(): Element {
    return this.children[0];
  }

  getElementById(elementId: string): Element | null {
    return this.collectMatchingElements(el => el.id === elementId)[0] || null;
  }
}