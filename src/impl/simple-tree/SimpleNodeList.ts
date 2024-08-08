import {Node, NodeListOf} from '../../interfaces/dom-types.js';

export class SimpleNodeList<T extends Node> extends Array<T> implements NodeListOf<T> {
  constructor(length: number) {
    super(length);
  }
  item(index: number): T | null {
    return this[index] || null;
  }
  declare forEach: (callback: (value: T, key: number, parent: SimpleNodeList<T>) => void, thisArg?: any) => void;
}

