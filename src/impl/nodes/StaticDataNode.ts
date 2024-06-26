import {CDATASection, CharacterData, Comment, Document, NodeType, ParentNode, Text} from '../../decl/xml-lite-decl';
import {StaticEmptyNode} from './StaticEmptyNode';

export class StaticDataNode extends StaticEmptyNode implements CharacterData, Text, Comment, CDATASection {
  declare readonly ownerDocument: Document;
  readonly data: string;

  constructor(nodeType: NodeType,
              parentNode: ParentNode | null,
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