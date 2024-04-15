export const EOF = -1;
export const NUL = 0;
export const TAB = 0x9;
export const LF = 0xA;
export const FF = 0xC;
export const CR = 0xD;
export const SPACE = 0x20;
export const LT = '<'.charCodeAt(0);
export const GT = '>'.charCodeAt(0);
export const QUESTION = '?'.charCodeAt(0);
export const EXCLAMATION = '!'.charCodeAt(0);
export const HYPHEN = '-'.charCodeAt(0);
export const EQ = '='.charCodeAt(0);
export const APOSTROPHE = '\''.charCodeAt(0);
export const SINGLE_QUOTE = APOSTROPHE;
export const QUOTE = '\"'.charCodeAt(0);
export const DOUBLE_QUOTE = QUOTE;
export const SOLIDUS = '/'.charCodeAt(0);
export const SLASH = SOLIDUS;
export const AMPERSAND = '&'.charCodeAt(0);
export const SEMICOLON = ';'.charCodeAt(0);
export const COLON = ':'.charCodeAt(0);
export const SHARP = '#'.charCodeAt(0);
export const X_REGULAR = 'x'.charCodeAt(0);
export const X_CAPITAL = 'X'.charCodeAt(0);
export const OPEN_SQUARE_BRACKET = '['.charCodeAt(0);
export const CLOSE_SQUARE_BRACKET = ']'.charCodeAt(0);
export const REPLACEMENT_CHAR = 0xFFFD;

export const CMT_START = stringToArray('<!--');
export const CMT_END = stringToArray('-->');
export const CD_START = stringToArray('<![CDATA[');
export const CD_END = stringToArray(']]>');
export const PI_START = stringToArray('<?');
export const PI_END = stringToArray('?>');
export const DOCTYPE = stringToArray('DOCTYPE');
export const PUBLIC_ID = stringToArray('PUBLIC');
export const SYSTEM_ID = stringToArray('SYSTEM');

export type CharCodePredicate = (code: number) => boolean;
export function range(lo: number, hi: number, loInclusive: boolean = true, hiInclusive: boolean = true): CharCodePredicate {
  return loInclusive ?
      (hiInclusive ? code => lo <= code && code <= hi : code => lo <= code && code < hi) :
      (hiInclusive ? code => lo < code && code <= hi : code => lo < code && code < hi);
}
export function or(...predicates: CharCodePredicate[]): CharCodePredicate {
  return code => predicates.some(p => p(code));
}
export function stringToArray(s: string): number[] {
  return [...s].map(c => c.codePointAt(0)!);
}
export function isSpace(code: number): boolean {
  return code === 0x20 || code === 9 || code === 10 || code === 13;
}
export const isAsciiLowerAlpha = range(0x61, 0x7A);
export const isAsciiUpperAlpha = range(0x41, 0x5A);
export const isAsciiAlpha = or(isAsciiLowerAlpha, isAsciiUpperAlpha);
export const isDigit = range(0x30, 0x39);
export const isLowerHexDigit = range(0x61, 0x66);
export const isUpperHexDigit = range(0x41, 0x46);
export const isHexDigit = or(isDigit, isUpperHexDigit, isLowerHexDigit);
export const isAsciiAlphaNum = or(isAsciiAlpha, isDigit);
export const isC0Control = range(0x00, 0x1F);
export const isControl = or(isC0Control, range(0x7F, 0x9F));
export const isLeadingSurrogate = range(0xD800, 0xDBFF);
export const isTrailingSurrogate = range(0xDC00, 0xDFFF);
export const isSurrogate = or(isLeadingSurrogate, isTrailingSurrogate);
export function isNonCharacter(code: number): boolean {
  return ((code & 0xFFFE) === 0xFFFE) || (code >= 0xFDD0 && code <= 0xFDEF);
}
function isCommonNameStartChar(code: number) {
  return isAsciiAlpha(code) ||
      code === 0x5F || // underscore (_)
      code === COLON;  // colon (:)
}
function isExoticNameStartChar(code: number) {
  return (code >= 0xC0 && code <= 0xD6) ||
      (code >= 0xD8 && code <= 0xF6) ||
      (code >= 0xF8 && code <= 0x2FF) ||
      (code >= 0x370 && code <= 0x37D) ||
      (code >= 0x37F && code <= 0x1FFF) ||
      (code >= 0x200C && code <= 0x200D) ||
      (code >= 0x2070 && code <= 0x218F) ||
      (code >= 0x2C00 && code <= 0x2FEF) ||
      (code >= 0x3001 && code <= 0xD7FF) ||
      (code >= 0xF900 && code <= 0xFDCF) ||
      (code >= 0xFDF0 && code <= 0xFFFD) ||
      (code >= 0x10000 && code <= 0xEFFFF);
}
function isCommonNameChar(code: number) {
  return isCommonNameStartChar(code) ||
      code === HYPHEN ||
      isDigit(code) ||
      code === 0x2E;// period (.)
}
function isExoticNameChar(code: number) {
  return isExoticNameStartChar(code) ||
      code === 0xB7 || // middle dot
      (code >= 0x0300 && code <= 0x03F6) ||
      (code >= 0x203F && code <= 0x2040);
}
export function hexDigitToValue(code: number): number {
  if (isDigit(code)) return code - 0x30;
  if (code >= 0x41 && code <= 0x46) return 10 + code - 0x41;
  if (code >= 0x61 && code <= 0x66) return 10 + code - 0x61;
  return NaN;
}
export function isNameStartChar(code: number): boolean {
  return isCommonNameStartChar(code) || isExoticNameStartChar(code);
}
export function isNameChar(code: number): boolean {
  return isCommonNameChar(code) || isExoticNameChar(code);
}
export const KNOWN_ENTITIES: { readonly [key: string]: number[] } = {
  'lt': [LT],
  'gt': [GT],
  'amp': [AMPERSAND],
  'apos': [SINGLE_QUOTE],
  'quot': [DOUBLE_QUOTE],
  'tab': [0x09],
  'newline': [0x0A],
  'nbsp': [0x00A0],
  'ndash': [0x2013],
  'mdash': [0x2014]
}
