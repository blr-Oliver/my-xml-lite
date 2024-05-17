import {Attribute} from '../tokens';

export class StaticAttributes {
  readonly names: string[];
  readonly map: { [name: string]: string | null };

  constructor(attributes: Attribute[]) {
    const len = attributes.length;
    const names = this.names = Array(len);
    const map: { [name: string]: string | null } = this.map = {};
    for (let i = 0; i < len; ++i) {
      const attr = attributes[i];
      map[names[i] = attr.name] = attr.value;
    }
  }

  getAttribute(qName: string): string | null {
    return this.map[qName] || null;
  }
  getAttributeNames(): string[] {
    return this.names;
  }
  hasAttribute(qName: string): boolean {
    return qName in this.map;
  }
  hasAttributes(): boolean {
    return this.names.length !== 0;
  }
  get length() {
    return this.names.length;
  }
}