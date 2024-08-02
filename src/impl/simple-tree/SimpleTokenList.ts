import {DOMTokenList} from '../../decl/dom-like.js';

export class SimpleTokenList extends Array<string> implements DOMTokenList {
  readonly value: string;
  readonly #set: Set<string>;
  [index: number]: string;

  constructor(value: string) {
    const rawTokens = value.trim().split(/\s+/);
    const set = new Set<string>(rawTokens);
    super(set.size);
    this.value = value;
    this.#set = set;
    const count = rawTokens.length;
    for (let i = 0, j = 0; i < count; ++i) {
      const token = rawTokens[i];
      if (!set.has(token)) this[j++] = token;
    }
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