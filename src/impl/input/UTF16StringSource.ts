import {CharacterSource} from '../../interfaces/CharacterSource.js';
import {CodePoints} from '../../interfaces/CodePoints.js';

export class UTF16StringSource implements CharacterSource {
  data: string;
  position: number;

  constructor(data: string, position: number = 0) {
    this.data = data;
    this.position = position;
  }

  next(): number {
    return this.position === this.data.length ? CodePoints.EOF : this.data.charCodeAt(this.position++);
  }
}