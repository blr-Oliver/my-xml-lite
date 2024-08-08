import {CDATASection, NodeType} from '../../interfaces/dom-types.js';
import {SimpleParentNode} from './SimpleParentNode.js';
import {SimpleText} from './SimpleText.js';

export class SimpleCDataSection extends SimpleText implements CDATASection {
  constructor(parent: SimpleParentNode, data: string) {
    super(parent, data, NodeType.CDATA_SECTION_NODE);
  }
  get nodeName(): string {
    return '#cdata-section';
  }
}