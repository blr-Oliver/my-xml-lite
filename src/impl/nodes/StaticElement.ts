import {Attr, Document, Element, Node, NodeType, ParentNode, StringList} from '../../decl/xml-lite-decl';
import {TagToken} from '../tokens';
import {NamespaceNamedNodeMap, StaticAttributes} from './StaticAttributes';
import {StaticParentNode} from './StaticParentNode';
import {StaticStringList} from './StaticStringList';

export class StaticElement extends StaticParentNode implements Element {
  readonly ownerDocument!: Document;
  readonly attributes: NamespaceNamedNodeMap;
  readonly classList: StringList;
  readonly id: string;
  readonly className: string;
  readonly namespaceURI: string | null;
  readonly prefix: string | null;
  readonly localName: string;
  readonly tagName: string;
  readonly selfClosed: boolean;

  readonly parentElementIndex: number;
  constructor(tag: TagToken,
              namespaceURI: string | null,
              parentNode: ParentNode | null,
              childNodes: Node[],
              parentIndex: number,
              parentElementIndex: number,
              children: Element[]) {
    super(NodeType.ELEMENT_NODE, parentNode, parentIndex, childNodes, children);
    this.namespaceURI = namespaceURI;
    this.attributes = new StaticAttributes(tag.attributes, this) as unknown as NamespaceNamedNodeMap;
    this.id = this.attributes.getAttribute('id') || '';
    const classList = new StaticStringList(this.attributes.getAttribute('class') || '');
    this.classList = classList;
    this.className = classList.join(' ');
    this.prefix = null; // TODO prefix must be meaningful
    this.tagName = this.localName = tag.name;
    this.selfClosed = tag.selfClosing;
    this.parentElementIndex = parentElementIndex;
  }

  get nextElementSibling(): Element | null {
    return this.parentNode ? this.parentNode.children[this.parentElementIndex + 1] || null : null;
  }
  get previousElementSibling(): Element | null {
    return this.parentNode ? this.parentNode.children[this.parentElementIndex - 1] || null : null;
  }

  getAttribute(qName: string): string | null {
    return this.attributes.getAttribute(qName);
  }
  getAttributeNS(prefix: string | null, localName: string): string | null {
    return this.attributes.getAttributeNS(prefix, localName);
  }
  getAttributeNames(): string[] {
    return this.attributes.getAttributeNames();
  }
  getAttributeNode(qName: string): Attr | null {
    return this.attributes.getNamedItem(qName);
  }
  getAttributeNodeNS(namespace: string | null, localName: string): Attr | null {
    return this.attributes.getNamedItemNS(namespace, localName);
  }
  hasAttribute(qName: string): boolean {
    return this.attributes.hasAttribute(qName);
  }
  hasAttributeNS(prefix: string | null, localName: string): boolean {
    return this.attributes.hasAttributeNS(prefix, localName);
  }
  hasAttributes(): boolean {
    return this.attributes.hasAttributes();
  }
}