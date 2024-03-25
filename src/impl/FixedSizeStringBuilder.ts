import {StringBuilder} from '../decl/StringBuilder';

export class FixedSizeStringBuilder implements StringBuilder {
  buffer: Uint32Array;
  position: number = 0;

  constructor(size: number = 1 << 12) {
    this.buffer = new Uint32Array(size);
  }

  clear() {
    this.position = 0;
  }
  append(code: number) {
    this.buffer[this.position++] = code;
  }
  appendSequence(seq: number[]): void {
    const l = seq.length;
    const buffer = this.buffer;
    let i = 0, j = this.position;
    while (i < l)
      buffer[j++] = seq[i++];
    this.position = j;
  }
  getString(from = 0, to: number = this.position): string {
    return String.fromCodePoint(...this.buffer.subarray(from, to));
  }
  getCodes(from: number = 0, to: number = this.position): number[] {
    return [...this.buffer.subarray(from, to)];
  }
}