import {StringSource} from '../common/stream-source';
import {StringBuilder} from './StringBuilder';

export interface ParserInterface {
  readonly input: StringSource;
  readonly buffer: StringBuilder;
  readonly errors: string[];
  reconsume: boolean;
}