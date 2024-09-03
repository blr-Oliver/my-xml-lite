export const enum TokenType {
  EOF = -1,
  DOCTYPE = 1,
  START_TAG,
  END_TAG,
  COMMENT,
  CHARACTERS,
  CDATA
}

export interface Token {
  type: TokenType;
}

export interface DoctypeToken extends Token {
  type: TokenType.DOCTYPE;
  name: string | undefined;
  publicId: string | undefined;
  systemId: string | undefined;
  forceQuirks: boolean;
}

export interface Attribute {
  name: string;
  value: string | null;
}

export interface NamespacedAttribute extends Attribute {
  prefix?: string;
  localName?: string;
  namespaceURI?: string;
}

export interface TagToken extends Token {
  type: TokenType.START_TAG | TokenType.END_TAG;
  name: string;
  selfClosed: boolean;
  attributes: Attribute[];
}

export interface TextToken extends Token {
  type: TokenType.COMMENT | TokenType.CHARACTERS | TokenType.CDATA;
  data: string;
}

export interface CharactersToken extends TextToken {
  type: TokenType.CHARACTERS | TokenType.CDATA;
  whitespaceOnly: boolean;
}

export interface CommentToken extends TextToken {
  type: TokenType.COMMENT;
}

export interface CDataToken extends CharactersToken {
  type: TokenType.CDATA;
}

export const EOF_TOKEN: Token = {
  type: TokenType.EOF
} as const;