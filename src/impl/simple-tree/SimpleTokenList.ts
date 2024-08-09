import {DOMTokenList} from '../../interfaces/dom-types.js';

export class SimpleTokenList extends Array<string> implements DOMTokenList {
  readonly value: string;
  readonly #set: Set<string>;
  [index: number]: string;

  constructor(value: string) {
    const set = new Set<string>(value.trim().split(/\s+/));
    super(set.size);
    this.value = value;
    this.#set = set;
    let i = 0;
    set.forEach(value => this[i++] = value);
  }
  toString(): string {
    return this.value;
  }
  contains(token: string): boolean {
    return this.#set.has(token);
  }
  item(index: number): string | null {
    return this[index] || null;
  }
  declare forEach: (callback: (value: string, key: number, parent: SimpleTokenList) => void, thisArg?: any) => void;
}