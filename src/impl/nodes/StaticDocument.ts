import {Document, Element, Node, NodeType} from '../../decl/xml-lite-decl';
import {StaticElement} from './StaticElement';
import {StaticParentNode} from './StaticParentNode';

export class StaticDocument extends StaticParentNode implements Document {
  constructor(childNodes: Node[], children?: StaticElement[]) {
    super(NodeType.DOCUMENT_NODE, null, -1, childNodes, children);
  }

  get documentElement(): Element {
    return this.children[0];
  }
}