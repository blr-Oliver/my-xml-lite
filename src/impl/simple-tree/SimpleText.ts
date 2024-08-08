import {NodeType, Text} from '../../interfaces/dom-types.js';
import {SimpleCharacterData} from './SimpleCharacterData.js';
import {SimpleParentNode} from './SimpleParentNode.js';

export class SimpleText extends SimpleCharacterData implements Text {
  constructor(parent: SimpleParentNode, data: string, nodeType: NodeType = NodeType.TEXT_NODE) {
    super(nodeType, parent, data);
  }
  get nodeName(): string {
    return '#text';
  }
}