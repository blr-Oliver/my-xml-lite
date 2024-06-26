import {StringSource} from '../common/stream-source';
import {Token} from '../impl/tokens';
import {StringBuilder} from './StringBuilder';

export interface ParserEnvironment {
  readonly input: StringSource;
  readonly buffer: StringBuilder;
  readonly errors: string[];
  tokens?: TokenSink;
}

export interface TokenSink {
  accept(token: Token): void;
}