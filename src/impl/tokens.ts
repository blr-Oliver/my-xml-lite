export type TokenType = 'doctype' | 'startTag' | 'endTag' | 'comment' | 'character' | 'eof';

export interface Token {
  type: TokenType;
}

export interface DoctypeToken extends Token {
  type: 'doctype';
  name?: string;
  publicId?: string;
  systemId?: string;
  forceQuirks: boolean;
}

export interface Attribute {
  name: string;
  value?: string;
}

export interface TagToken extends Token {
  type: 'startTag' | 'endTag';
  name: string;
  selfClosing: boolean;
  attributes: Attribute[];
}

export interface TextToken extends Token {
  type: 'comment' | 'character';
  data: string;
}

export const EOF_TOKEN: Token = {
  type: 'eof'
} as const;