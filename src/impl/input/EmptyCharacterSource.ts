import {CodePoints} from '../../common/code-points.js';
import {CharacterSource} from '../../common/stream-source.js';

export class EmptyCharacterSource implements CharacterSource {
  next(): number {
    return CodePoints.EOF;
  }
}

export const EMPTY_SOURCE = new EmptyCharacterSource();