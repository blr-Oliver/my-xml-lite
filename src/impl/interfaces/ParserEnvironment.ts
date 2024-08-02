import {Token} from './tokens.js';

export interface ParserEnvironment {
  tokens?: TokenSink;
}

export interface TokenSink {
  accept(token: Token): void;
}