export type TokenType = 'doctype' | 'startTag' | 'endTag' | 'comment' | 'characters' | 'cdata' | 'eof';

export interface Token {
  type: TokenType;
}

export interface DoctypeToken extends Token {
  type: 'doctype';
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
  type: 'startTag' | 'endTag';
  name: string;
  selfClosed: boolean;
  attributes: Attribute[];
}

export interface TextToken extends Token {
  type: 'comment' | 'characters' | 'cdata';
  data: string;
}

export interface CharactersToken extends TextToken {
  type: 'characters' | 'cdata';
  whitespaceOnly: boolean;
}

export interface CommentToken extends TextToken {
  type: 'comment';
}

export interface CDataToken extends CharactersToken {
  type: 'cdata';
}

export const EOF_TOKEN: Token = {
  type: 'eof'
} as const;