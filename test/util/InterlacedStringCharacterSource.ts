import {CodePoints} from '../../src/common/code-points.js';
import {StringCharacterSource} from '../../src/impl/input/StringCharacterSource.js';

export class InterlacedStringCharacterSource extends StringCharacterSource {
  readonly frequency: number;
  counter: number;

  constructor(frequency: number, source: string) {
    super(source);
    this.frequency = frequency;
    this.counter = 0;
  }
  next(): number {
    if (!this.counter) {
      this.counter = this.frequency;
      return CodePoints.EOC;
    } else {
      const result = super.next();
      if (result === CodePoints.EOF) {
        if (this.counter === this.frequency) return CodePoints.EOF;
        this.counter = this.frequency;
        return CodePoints.EOC;
      } else {
        this.counter--;
        return result;
      }
    }
  }
  setData(data: number[], start: number = 0, end: number = data.length) {
    super.setData(data, start, end);
    this.counter = 0;
  }
}