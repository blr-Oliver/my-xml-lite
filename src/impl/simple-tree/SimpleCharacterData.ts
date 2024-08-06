import {CharacterData, NodeType} from '../../decl/dom-like.js';
import {SimpleChildNode} from './SimpleChildNode.js';
import {SimpleDocument} from './SimpleDocument.js';
import {SimpleParentNode} from './SimpleParentNode.js';

export abstract class SimpleCharacterData extends SimpleChildNode implements CharacterData {
  declare ownerDocument: SimpleDocument;
  declare parentNode: SimpleParentNode;
  readonly data: string;

  protected constructor(nodeType: NodeType, parent: SimpleParentNode, data: string) {
    super(nodeType, parent);
    this.elementIndex = parent.children.length;
    this.data = data;
  }
  hasChildNodes(): boolean {
    return false;
  }
  get length(): number {
    return this.data.length;
  }
  get nodeValue(): string {
    return this.data;
  }
}