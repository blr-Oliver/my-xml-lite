import {CharacterSource} from '../common/stream-source';
import {StringBuilder} from './StringBuilder';

export namespace Tokenizer {
  export enum TokenType {
    ELEMENT_NODE = 1,
    ELEMENT_END_NODE = 2,
    TEXT_NODE = 3,
    CDATA_SECTION_NODE = 4,
    PROCESSING_INSTRUCTION_NODE = 7,
    COMMENT_NODE = 8,
    DOCUMENT_TYPE_NODE = 10,
  }

  export interface Token {
    type: TokenType;
  }

  export interface CharacterData extends Token {
    data: string;
  }

  export interface ProcessingInstruction extends CharacterData {
    target: string;
  }

  export interface Declaration extends Token {
    name: string;
    publicId?: string;
    systemId?: string;
    inline?: any;
  }

  export interface Tag extends Token {
    name: string;
    opening: boolean;
  }

  export interface StartTag extends Tag {
    attributes: Attribute[];
    selfClosed: boolean;
  }

  export interface Attribute {
    name: string;
    value: string | null;
  }

  export interface State {
    input: CharacterSource;
    stringBuilder: StringBuilder;
  }

  export interface Tokenizer {
    nextToken(): Token | null;
  }

  export interface TokenizerInternals extends State, Tokenizer {
  }
}

