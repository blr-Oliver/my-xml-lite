import {Element, NodeType} from '../../interfaces/dom-types.js';
import {TagToken} from '../interfaces/tokens.js';
import {SimpleAttr} from './SimpleAttr.js';
import {SimpleDocument} from './SimpleDocument.js';
import {SimpleNodeMap} from './SimpleNodeMap.js';
import {SimpleParentNode} from './SimpleParentNode.js';
import {SimpleTokenList} from './SimpleTokenList.js';

export class SimpleElement extends SimpleParentNode implements Element {
  declare ownerDocument: SimpleDocument;
  declare parentNode: SimpleParentNode;
  readonly attributes: SimpleNodeMap;
  readonly classList: SimpleTokenList;
  readonly className: string;
  readonly id: string;
  readonly localName: string;
  readonly namespaceURI: string | null;
  readonly prefix: string | null;
  readonly tagName: string;
  readonly selfClosed: boolean;

  constructor(parentNode: SimpleParentNode | null, token: TagToken,
              namespaceURI: string | null) {
    super(NodeType.ELEMENT_NODE, parentNode);
    this.namespaceURI = namespaceURI;
    this.attributes = new SimpleNodeMap(this, token.attributes);
    this.id = this.attributes.getNamedItem('id')?.value || '';
    this.className = this.attributes.getNamedItem('class')?.value || '';
    this.classList = new SimpleTokenList(this.className);
    this.prefix = null;
    this.tagName = this.localName = token.name;
    this.selfClosed = token.selfClosed;
  }

  get nextElementSibling(): SimpleElement | null {
    return this.parentNode!.children[this.elementIndex + 1] || null;
  }

  closest(selectors: string): Element | null {
    return this.nwsapi.closest(selectors, this as any) as Element | null;
  }
  getAttribute(qualifiedName: string): string | null {
    return this.attributes.getNamedItem(qualifiedName)?.value || null;
  }
  getAttributeNS(namespace: string | null, localName: string): string | null {
    return this.attributes.getNamedItemNS(namespace, localName)?.value || null;
  }
  getAttributeNames(): string[] {
    return this.attributes.names;
  }
  getAttributeNode(qualifiedName: string): SimpleAttr | null {
    return this.attributes.getNamedItem(qualifiedName);
  }
  getAttributeNodeNS(namespace: string | null, localName: string): SimpleAttr | null {
    return this.attributes.getNamedItemNS(namespace, localName);
  }
  hasAttribute(qualifiedName: string): boolean {
    return this.attributes.getNamedItem(qualifiedName) !== null;
  }
  hasAttributeNS(namespace: string | null, localName: string): boolean {
    return this.attributes.getNamedItemNS(namespace, localName) !== null;
  }
  hasAttributes(): boolean {
    return this.attributes.length !== 0;
  }
  get nodeName(): string {
    return this.tagName;
  }
  matches(selectors: string): boolean {
    return this.nwsapi.match(selectors, this as any);
  }
}