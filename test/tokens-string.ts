import {TokenType} from '../src/impl/interfaces/tokens.js';

export enum TokenTypeStringEnum {
  EOF = 'eof',
  DOCTYPE = 'doctype',
  START_TAG = 'startTag',
  END_TAG = 'endTag',
  COMMENT = 'comment',
  CHARACTERS = 'characters',
  CDATA = 'cdata'
}

export enum TokenTypeStringReversedEnum {
  'eof' = TokenType.EOF,
  'doctype' = TokenType.DOCTYPE,
  'startTag' = TokenType.START_TAG,
  'endTag' = TokenType.END_TAG,
  'comment' = TokenType.COMMENT,
  'characters' = TokenType.CHARACTERS,
  'cdata' = TokenType.CDATA
}
