import {ArrayCharacterSource} from './ArrayCharacterSource.js';

export class StringCharacterSource extends ArrayCharacterSource<number[]> {
  #source: string;

  constructor(source: string) {
    super(Array.from(source, c => c.codePointAt(0)!));
    this.#source = source;
  }

  get source(): string {
    return this.#source;
  }

  set source(source: string) {
    super.setData(Array.from(source, c => c.codePointAt(0)!));
    this.#source = source;
  }
}