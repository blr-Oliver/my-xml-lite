import {Element, Node, NodeListOf, NodeType, ParentNode} from '../../decl/xml-lite-decl';
import {StaticEmptyNode} from './StaticEmptyNode';

export class StaticParentNode extends StaticEmptyNode implements ParentNode {
  readonly children: Element[];

  constructor(nodeType: NodeType,
              parentNode: ParentNode | null,
              childNodes: Node[],
              children?: Element[]) {
    super(nodeType, parentNode, childNodes);
    this.children = children || childNodes.filter(node => node.nodeType === NodeType.ELEMENT_NODE) as Element[];
  }

  get nodeValue(): string | null {
    return null;
  }
  get firstChild(): Node | null {
    return this.childNodes[0] || null;
  }
  get lastChild(): Node | null {
    const len = this.childNodes.length;
    return len ? this.childNodes[len - 1] : null;
  }
  hasChildNodes(): boolean {
    return this.childNodes.length !== 0;
  }
  get childElementCount(): number {
    return this.children.length;
  }
  get firstElementChild(): Element | null {
    return this.children[0] || null;
  }
  get lastElementChild(): Element | null {
    const len = this.children.length;
    return len ? this.children[len - 1] : null;
  }

  getElementsByClassName(classes: string): NodeListOf<Element> {
    if (!classes) return [];
    const classList = classes.split(/\s+/);
    if (!classList.length) return [];
    return this.collectMatchingElements(el => classList.every(cls => el.classList.contains(cls)));
  }

  getElementsByTagName(name: string): NodeListOf<Element> {
    return this.collectMatchingElements(element => element.tagName === name);
  }

  getElementsByTagNameNS(namespaceURI: string | null, localName: string): NodeListOf<Element> {
    if (namespaceURI === '*') {
      if (localName === '*') return this.collectMatchingElements(() => true);
      else return this.collectMatchingElements(el => el.localName === localName);
    } else {
      if (localName === '*') return this.collectMatchingElements(el => el.namespaceURI === namespaceURI);
      else return this.collectMatchingElements(el => el.namespaceURI === namespaceURI && el.localName === localName);
    }
  }

  protected traverseNodesFrom(root: Node, callback: (node: Node) => void) {
    const childNodes = root.childNodes;
    const len = childNodes.length;
    for (let i = 0; i < len; ++i) {
      const childNode = childNodes[i];
      callback(childNode);
      this.traverseNodesFrom(childNode, callback);
    }
  }
  protected traverseElementsFrom(root: ParentNode, callback: (element: Element) => void) {
    const children = root.children;
    const len = children.length;
    for (let i = 0; i < len; ++i) {
      const child = children[i];
      callback(child);
      this.traverseElementsFrom(child, callback);
    }
  }
  protected collectMatchingElements(callback: (element: Element) => boolean) {
    const result: Element[] = [];
    this.traverseElementsFrom(this, element => {
      if (callback(element))
        result.push(element);
    });
    return result;
  }
}