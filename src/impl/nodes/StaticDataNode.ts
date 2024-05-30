import {CDATASection, CharacterData, Comment, Document, NodeType, ParentNode, Text} from '../../decl/xml-lite-decl';
import {StaticEmptyNode} from './StaticEmptyNode';

export class StaticDataNode extends StaticEmptyNode implements CharacterData, Text, Comment, CDATASection {
  readonly ownerDocument!: Document;
  readonly data: string;

  constructor(nodeType: NodeType,
              parentNode: ParentNode | null,
              parentIndex: number,
              data: string) {
    super(nodeType, parentNode);
    this.data = data;
  }

  get nodeValue(): string {
    return this.data;
  }
}