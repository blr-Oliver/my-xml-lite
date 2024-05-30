import {Attr, Element, NamedNodeMap} from '../../decl/xml-lite-decl';
import {NamespacedAttribute} from '../tokens';
import {StaticAttr} from './StaticAttr';

export interface NamespaceNamedNodeMap extends NamedNodeMap {
  getAttribute(qName: string): string | null;
  getAttributeNS(namespace: string | null, localName: string): string | null;
  getAttributeNames(): string[];
  hasAttribute(qName: string): boolean;
  hasAttributeNS(prefix: string | null, localName: string): boolean;
  hasAttributes(): boolean;
}

//@ts-ignore
export class StaticAttributes implements NamespaceNamedNodeMap {
  readonly #attrs: Attr[];
  readonly #names: string[];
  readonly #map: { [name: string]: Attr };

  constructor(attributes: NamespacedAttribute[], ownerElement: Element) {
    const length = attributes.length;
    this.#attrs = new Array(length);
    this.#names = new Array(length);
    this.#map = {};
    for (let i = 0; i < length; ++i) {
      const attr = new StaticAttr(attributes[i], ownerElement);
      (this as any)[i] = this.#attrs[i] = attr;
      this.#map[this.#names[i] = attr.name] = attr;
      if (!(attr.name in this))
        (this as any)[attr.name] = attr;
    }
  }
  get length() {
    return this.#attrs.length;
  }
  getAttribute(qName: string): string | null {
    let attr = this.#map[qName];
    return attr ? attr.value : null;
  }
  getAttributeNS(namespace: string | null, localName: string): string | null {
    let attr = this.getNamedItemNS(namespace, localName);
    return attr ? attr.value : null;
  }
  getAttributeNames(): string[] {
    return this.#names;
  }
  hasAttribute(qName: string): boolean {
    return qName in this.#map;
  }
  hasAttributeNS(namespace: string | null, localName: string): boolean {
    return this.getNamedItemNS(namespace, localName) !== null;
  }
  hasAttributes(): boolean {
    return this.#attrs.length !== 0;
  }
  getNamedItem(qName: string): StaticAttr | null {
    return this.#map[qName] || null;
  }
  getNamedItemNS(namespace: string | null, localName: string): StaticAttr | null {
    namespace = namespace || null;
    return this.#attrs.find(attr => attr.namespaceURI === namespace && attr.localName === localName) || null;
  }
  item(index: number): StaticAttr {
    return this.#attrs[index];
  }
}