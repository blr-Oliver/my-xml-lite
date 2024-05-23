import {Element, Node, NodeType, ParentNode} from '../../decl/xml-lite-decl';
import {TagToken} from '../tokens';
import {StaticAttributes} from './StaticAttributes';
import {StaticParentNode} from './StaticParentNode';
import {StaticStringList} from './StaticStringList';

export class StaticElement extends StaticParentNode implements Element {
  readonly attributes: StaticAttributes;
  readonly classList: StaticStringList;
  readonly id: string;
  readonly className: string;
  readonly localName: string;
  readonly prefix: string | null;
  readonly selfClosed: boolean;
  readonly tagName: string;

  readonly parentElementIndex: number;
  constructor(tag: TagToken,
              parentNode: StaticParentNode | null,
              childNodes: Node[],
              parentIndex: number,
              parentElementIndex: number,
              children?: StaticElement[]) {
    super(NodeType.ELEMENT_NODE, parentNode, parentIndex, childNodes, children);
    this.attributes = new StaticAttributes(tag.attributes);
    this.id = this.attributes.getAttribute('id') || '';
    this.classList = new StaticStringList(this.attributes.getAttribute('class') || '');
    this.className = this.classList.join(' ');
    // TODO prefix must be meaningful
    this.prefix = null;
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
  getAttributeNames(): string[] {
    return this.attributes.getAttributeNames();
  }
  hasAttribute(qName: string): boolean {
    return this.attributes.hasAttribute(qName);
  }
  hasAttributes(): boolean {
    return this.attributes.hasAttributes();
  }
}