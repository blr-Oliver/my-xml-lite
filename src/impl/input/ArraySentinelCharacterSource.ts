import {CharacterSource} from '../../interfaces/CharacterSource.js';
import {CodePoints} from '../../interfaces/CodePoints.js';
import {Resettable} from '../../interfaces/Resettable.js';

export interface ArrayData {
  [index: number]: number;
}

export class ArraySentinelCharacterSource implements CharacterSource, Resettable {
  data: ArrayData;
  position: number;

  constructor(data: ArrayData) {
    this.data = data;
    this.position = 0;
  }

  next(): number {
    return this.data[this.position++];
  }

  reset(): void {
    this.position = 0;
  }

  static fromArray(data: number[], clone?: boolean): ArraySentinelCharacterSource {
    if (clone)
      data = data.slice();
    if (data[data.length - 1] !== CodePoints.EOF)
      data.push(CodePoints.EOF);
    return new ArraySentinelCharacterSource(data);
  }

  static fromString(data: string): ArraySentinelCharacterSource {
    const codePoints = [...data].map(x => x.codePointAt(0)!);
    codePoints.push(CodePoints.EOF);
    return new ArraySentinelCharacterSource(codePoints);
  }
}