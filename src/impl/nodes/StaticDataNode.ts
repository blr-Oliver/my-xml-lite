import {CDATASection, CharacterData, Comment, NodeType, ParentNode, Text} from '../../decl/xml-lite-decl';
import {StaticEmptyNode} from './StaticEmptyNode';

export class StaticDataNode extends StaticEmptyNode implements CharacterData, Text, Comment, CDATASection {
  readonly data: string;

  protected constructor(nodeType: NodeType,
                        parentNode: ParentNode | null,
                        parentIndex: number,
                        data: string) {
    super(nodeType, parentNode, parentIndex);
    this.data = data;
  }

  get nodeValue(): string {
    return this.data;
  }
}