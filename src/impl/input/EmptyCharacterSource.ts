import {CharacterSource} from '../../interfaces/CharacterSource.js';
import {CodePoints} from '../../interfaces/CodePoints.js';
import {Resettable} from '../../interfaces/Resettable.js';

export class EmptyCharacterSource implements CharacterSource, Resettable {
  next(): number {
    return CodePoints.EOF;
  }
  reset() {
  }
}

export const EMPTY_SOURCE = new EmptyCharacterSource();