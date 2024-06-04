import {DOMTokenList} from '../../decl/xml-lite-decl';

export class StaticTokenList implements DOMTokenList {
  readonly value: string;
  readonly #tokens: string[];
  readonly #map: { [token: string]: true };
  readonly [index: number]: string;

  constructor(value: string) {
    this.value = value;
    const rawTokens = value.trim().split(/\s+/);
    const tokens: string[] = this.#tokens = [];
    const map: { [token: string]: true } = this.#map = {};
    for (let token of rawTokens) {
      if (token in map) continue;
      (this as any)[tokens.length] = token;
      tokens.push(token);
      map[token] = true;
    }
  }
  get length(): number {
    return this.#tokens.length;
  }
  toString(): string {
    return this.value;
  }
  contains(token: string): boolean {
    return this.#map[token] || false;
  }
  item(index: number): string | null {
    return this.#tokens[index] || null;
  }
  [Symbol.iterator](): IterableIterator<string> {
    return this.#tokens.values();
  }
}