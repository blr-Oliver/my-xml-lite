import {Attr, NodeType} from '../../interfaces/dom-types.js';
import {NamespacedAttribute} from '../interfaces/tokens.js';
import {SimpleDocument} from './SimpleDocument.js';
import {SimpleElement} from './SimpleElement.js';
import {SimpleNode} from './SimpleNode.js';

export class SimpleAttr extends SimpleNode implements Attr {
  declare ownerDocument: SimpleDocument;
  declare parentNode: SimpleElement;
  readonly namespaceURI: string | null;
  readonly name: string;
  readonly value: string | null;
  readonly prefix: string | null;
  readonly localName: string;

  constructor(parent: SimpleElement, attributeToken: NamespacedAttribute, index: number) {
    super(NodeType.ATTRIBUTE_NODE, parent);
    this.namespaceURI = attributeToken.namespaceURI || null;
    this.name = attributeToken.name;
    this.value = attributeToken.value;
    this.prefix = attributeToken.prefix || null;
    this.localName = attributeToken.localName === undefined ? attributeToken.name : attributeToken.localName;
    this.nodeIndex = index;
  }

  get ownerElement(): SimpleElement {
    return this.parentNode;
  }
  get parentElement(): SimpleElement {
    return this.parentNode;
  }
  get firstChild(): null {
    return null;
  }
  get lastChild(): null {
    return null;
  }
  get previousSibling(): SimpleAttr | null {
    return this.parentNode.attributes[this.nodeIndex - 1] || null;
  }
  get nextSibling(): SimpleAttr | null {
    return this.parentNode.attributes[this.nodeIndex + 1] || null;
  }
  hasChildNodes(): boolean {
    return false;
  }

  get nodeName(): string {
    return this.name;
  }
  get nodeValue(): string | null {
    return this.value;
  }
}