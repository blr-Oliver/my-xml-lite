import {StringSource} from '../common/stream-source';
import {Token} from '../impl/tokens';
import {StringBuilder} from './StringBuilder';

export interface ParserEnvironment {
  readonly input: StringSource;
  readonly buffer: StringBuilder;
  readonly errors: string[];
  reconsume: boolean;
  state?: string;
  tokens?: TokenSink;
}

export interface TokenSink {
  emit(token: Token): void;
}