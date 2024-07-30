import {CDATASection, CharacterData, Comment, NodeType, Text} from '../../decl/xml-lite-decl.js';
import {StaticDocument} from './StaticDocument.js';
import {StaticEmptyNode} from './StaticEmptyNode.js';
import {StaticParentNode} from './StaticParentNode.js';

export class StaticDataNode extends StaticEmptyNode implements CharacterData, Text, Comment, CDATASection {
  declare readonly ownerDocument: StaticDocument;
  readonly data: string;

  constructor(nodeType: NodeType,
              parentNode: StaticParentNode | null,
              data: string) {
    super(nodeType, parentNode);
    this.data = data;
  }

  get nodeValue(): string {
    return this.data;
  }

  get length(): number {
    return this.data.length;
  }
}