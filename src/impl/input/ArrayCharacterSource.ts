import {CharacterSource, Resettable} from '../../common/stream-source.js';

export interface ArrayCharacterData {
  readonly [index: number]: number;
  readonly length: number;
}

export class ArrayCharacterSource<D extends ArrayCharacterData> implements CharacterSource, Resettable {
  #data: D;
  #start: number;
  #end: number;
  position: number;

  constructor(data: D, start: number = 0, end: number = data.length) {
    this.#data = data;
    this.position = this.#start = start;
    this.#end = end;
  }

  next(): number {
    return this.position >= this.end ? -1 : this.#data[this.position++];
  }

  reset(): void {
    this.position = this.start;
  }

  get data(): D {
    return this.#data;
  }

  get start(): number {
    return this.#start;
  }

  get end(): number {
    return this.#end;
  }

  setData(data: D, start: number = 0, end: number = data.length) {
    this.#data = data;
    this.position = this.#start = start;
    this.#end = end;
  }
}
