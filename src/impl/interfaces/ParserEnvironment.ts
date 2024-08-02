import {StringSource} from '../../common/stream-source.js';
import {StringBuilder} from '../../decl/StringBuilder.js';
import {Token} from './tokens.js';

export interface ParserEnvironment {
  readonly input: StringSource;
  readonly buffer: StringBuilder;
  tokens?: TokenSink;
}

export interface TokenSink {
  accept(token: Token): void;
}