import {CharacterSource} from '../common/stream-source';

export interface CharacterReferenceParser {
  output: number[][];
  errors: string[];
  reconsume: boolean;

  parse(input: CharacterSource, isAttribute: boolean): void;
}