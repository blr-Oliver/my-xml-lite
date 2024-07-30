import {Attr, Element, NodeType} from '../../decl/xml-lite-decl.js';
import {TagToken} from '../interfaces/tokens.js';
import {StaticAttributes} from './StaticAttributes.js';
import {StaticDocument} from './StaticDocument.js';
import {StaticParentNode} from './StaticParentNode.js';
import {StaticTokenList} from './StaticTokenList.js';

export class StaticElement extends StaticParentNode implements Element {
  declare readonly ownerDocument: StaticDocument;
  readonly attributes: StaticAttributes;
  readonly classList: StaticTokenList;
  readonly id: string;
  readonly className: string;
  readonly namespaceURI: string | null;
  readonly prefix: string | null;
  readonly localName: string;
  readonly tagName: string;
  readonly selfClosed: boolean;

  readonly attributeNames: string[];
  parentElementIndex: number;

  constructor(token: TagToken,
              namespaceURI: string | null,
              parentNode: StaticParentNode) {
    super(NodeType.ELEMENT_NODE, parentNode);
    this.namespaceURI = namespaceURI;
    this.attributeNames = token.attributes.map(attr => attr.name);
    this.attributes = new StaticAttributes(token.attributes, this);
    this.id = this.attributes.getNamedItem('id')?.value || '';
    this.className = this.attributes.getNamedItem('class')?.value || '';
    this.classList = new StaticTokenList(this.className);
    this.prefix = null;
    this.tagName = this.localName = token.name;
    this.selfClosed = token.selfClosed;
    this.parentElementIndex = parentNode.childElementCount;
  }

  get nextElementSibling(): Element | null {
    return this.parentNode ? this.parentNode.children[this.parentElementIndex + 1] || null : null;
  }
  get previousElementSibling(): Element | null {
    return this.parentNode ? this.parentNode.children[this.parentElementIndex - 1] || null : null;
  }

  getAttribute(qName: string): string | null {
    const attr = this.attributes.getNamedItem(qName);
    return attr ? attr.value : null;
  }
  getAttributeNS(namespace: string | null, localName: string): string | null {
    const attr = this.attributes.getNamedItemNS(namespace, localName);
    return attr ? attr.value : null;
  }
  getAttributeNames(): string[] {
    return this.attributeNames;
  }
  getAttributeNode(qName: string): Attr | null {
    return this.attributes.getNamedItem(qName);
  }
  getAttributeNodeNS(namespace: string | null, localName: string): Attr | null {
    return this.attributes.getNamedItemNS(namespace, localName);
  }
  hasAttribute(qName: string): boolean {
    return this.attributes.getNamedItem(qName) !== null;
  }
  hasAttributeNS(namespace: string | null, localName: string): boolean {
    return this.attributes.getNamedItemNS(namespace, localName) !== null;
  }
  hasAttributes(): boolean {
    return this.attributes.length !== 0;
  }
  get debug(): string {
    const chunks: string[] = ['<', this.tagName];
    const attrCount = this.attributes.length;
    for (let i = 0; i < attrCount; ++i) {
      const attr = this.attributes.item(i);
      chunks.push(' ', attr.name);
      if (attr.value !== null)
        chunks.push('="', attr.value, '"');
    }
    if (this.selfClosed) chunks.push('/');
    chunks.push('>');
    return chunks.join('');
  }
}