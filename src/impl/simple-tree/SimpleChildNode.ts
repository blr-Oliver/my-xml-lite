import {ChildNode, NodeType} from '../../decl/dom-like.js';
import {SimpleNode} from './SimpleNode.js';
import {SimpleParentNode} from './SimpleParentNode.js';

export abstract class SimpleChildNode extends SimpleNode implements ChildNode {
  protected constructor(nodeType: NodeType, parent: SimpleParentNode) {
    super(nodeType, parent);
  }
}