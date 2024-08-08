import {CharacterSource, Resettable} from '../../common/character-source.js';
import {CodePoints} from '../../common/code-points.js';

export class EmptyCharacterSource implements CharacterSource, Resettable {
  next(): number {
    return CodePoints.EOF;
  }
  reset() {
  }
}

export const EMPTY_SOURCE = new EmptyCharacterSource();