import {CharacterSource} from '../common/stream-source';
import {StringBuilder} from './StringBuilder';

export interface ParserInterface {
  readonly input: CharacterSource;
  readonly buffer: StringBuilder
  readonly errors: string[];
  reconsume: boolean;
}