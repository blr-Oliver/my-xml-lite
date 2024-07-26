import {StringSource} from '../../common/stream-source';
import {StringBuilder} from '../../decl/StringBuilder';
import {Token} from './tokens';

export interface ParserEnvironment {
  readonly input: StringSource;
  readonly buffer: StringBuilder;
  readonly errors: string[];
  tokens?: TokenSink;
}

export interface TokenSink {
  accept(token: Token): void;
}