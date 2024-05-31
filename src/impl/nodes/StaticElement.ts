import {Attr, Document, Element, NamedNodeMap, Node, NodeType, ParentNode, StringList} from '../../decl/xml-lite-decl';
import {TagToken} from '../tokens';
import {StaticAttributes} from './StaticAttributes';
import {StaticParentNode} from './StaticParentNode';
import {StaticStringList} from './StaticStringList';

export class StaticElement extends StaticParentNode implements Element {
  declare readonly ownerDocument: Document;
  readonly attributes: NamedNodeMap;
  readonly classList: StringList;
  readonly id: string;
  readonly className: string;
  readonly namespaceURI: string | null;
  readonly prefix: string | null;
  readonly localName: string;
  readonly tagName: string;
  readonly selfClosed: boolean;

  readonly attributeNames: string[];
  parentElementIndex: number;

  constructor(tag: TagToken,
              namespaceURI: string | null,
              parentNode: ParentNode,
              childNodes: Node[],
              children: Element[]) {
    super(NodeType.ELEMENT_NODE, parentNode, childNodes, children);
    this.namespaceURI = namespaceURI;
    this.attributeNames = tag.attributes.map(attr => attr.name);
    this.attributes = new StaticAttributes(tag.attributes, this) as unknown as NamedNodeMap;
    this.id = this.attributes.getNamedItem('id')?.value || '';
    const classList = new StaticStringList(this.attributes.getNamedItem('class')?.value || '');
    this.classList = classList;
    this.className = classList.join(' ');
    this.prefix = null; // TODO prefix must be meaningful
    this.tagName = this.localName = tag.name;
    this.selfClosed = tag.selfClosing;
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
}