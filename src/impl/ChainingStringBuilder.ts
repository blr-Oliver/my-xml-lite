import {StringBuilder} from '../decl/StringBuilder';

export class ChainingStringBuilder implements StringBuilder {
  readonly host: StringBuilder;
  readonly offset: number;

  constructor(host: StringBuilder, offset: number = host.position) {
    this.host = host;
    this.host.position = (this.offset = offset);
  }

  get buffer(): ArrayLike<number> {
    return this.host.buffer;
  }
  get position() {
    return this.host.position - this.offset;
  }
  set position(value: number) {
    this.host.position = value + this.offset;
  }

  clear(): void {
    this.position = 0;
  }
  append(code: number): void {
    this.host.append(code);
  }
  appendSequence(seq: number[]): void {
    this.host.appendSequence(seq);
  }
  getString(from: number = 0, to: number = this.position): string {
    return this.host.getString(from + this.offset, to + this.offset);
  }
  takeString(from = 0, to: number = this.position): string {
    this.host.position = this.offset;
    return this.host.getString(from + this.offset, to + this.offset);
  }
  getCodes(from: number = 0, to: number = this.position): number[] {
    return this.host.getCodes(from + this.offset, to + this.offset);
  }
}