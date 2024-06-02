import {Attr, Element, NamedNodeMap} from '../../decl/xml-lite-decl';
import {NamespacedAttribute} from '../tokens';
import {StaticAttr} from './StaticAttr';

export class StaticAttributes implements NamedNodeMap {
  readonly #attrs: Attr[];
  readonly #map: { [name: string]: Attr };
  readonly [index: number]: Attr;

  constructor(attributes: NamespacedAttribute[], ownerElement: Element) {
    const length = attributes.length;
    this.#attrs = new Array(length);
    this.#map = {};
    for (let i = 0; i < length; ++i) {
      const attr = new StaticAttr(attributes[i], ownerElement);
      (this as any)[i] = this.#attrs[i] = attr;
      this.#map[attr.name] = attr;
      if (!(attr.name in this))
        (this as any)[attr.name] = attr;
    }
  }
  get length() {
    return this.#attrs.length;
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
  [Symbol.iterator](): IterableIterator<Attr> {
    return this.#attrs.values();
  }
}