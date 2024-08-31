import {CharacterSource} from '../../interfaces/CharacterSource.js';
import {CodePoints} from '../../interfaces/CodePoints.js';

export class StringSentinelSource implements CharacterSource {
  codePoints: number[];
  position: number;

  constructor(data: string) {
    this.codePoints = Array.from(data, s => s.codePointAt(0)!);
    this.codePoints.push(CodePoints.EOF);
    this.position = 0;
  }

  next(): number {
    return this.codePoints[this.position++];
  }
}