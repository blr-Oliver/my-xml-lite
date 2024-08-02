import {Comment, NodeType} from '../../decl/dom-like.js';
import {SimpleCharacterData} from './SimpleCharacterData.js';
import {SimpleParentNode} from './SimpleParentNode.js';

export class SimpleComment extends SimpleCharacterData implements Comment {
  constructor(parent: SimpleParentNode, data: string) {
    super(NodeType.COMMENT_NODE, parent, data);
  }
  get nodeName(): string {
    return '#comment';
  }
}