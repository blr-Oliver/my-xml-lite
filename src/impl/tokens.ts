export type TokenType = 'doctype' | 'startTag' | 'endTag' | 'comment' | 'characters' | 'eof';

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
  value: string | undefined;
}

export interface TagToken extends Token {
  type: 'startTag' | 'endTag';
  name: string;
  selfClosing: boolean;
  attributes: Attribute[];
}

export interface TextToken extends Token {
  type: 'comment' | 'characters';
  data: string;
}

export const EOF_TOKEN: Token = {
  type: 'eof'
} as const;