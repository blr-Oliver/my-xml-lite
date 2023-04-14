export const EOF = -1;
export const LT = '<'.charCodeAt(0);
export const GT = '>'.charCodeAt(0);
export const QUESTION = '?'.charCodeAt(0);
export const EXCLAMATION = '!'.charCodeAt(0);
export const HYPHEN = '-'.charCodeAt(0);
export const EQ = '='.charCodeAt(0);
export const QUOTE = '\''.charCodeAt(0);
export const DOUBLE_QUOTE = '\"'.charCodeAt(0);
export const SLASH = '/'.charCodeAt(0);
export const AMPERSAND = '&'.charCodeAt(0);
export const SEMICOLON = ';'.charCodeAt(0);
export const COLON = ':'.charCodeAt(0);
export const SHARP = '#'.charCodeAt(0);
export const X_REGULAR = 'x'.charCodeAt(0);
export const X_CAPITAL = 'X'.charCodeAt(0);
export const OPEN_SQUARE_BRACKET = '['.charCodeAt(0);
export const CLOSE_SQUARE_BRACKET = ']'.charCodeAt(0);

export const CMT_START = stringToArray('<!--');
export const CMT_END = stringToArray('-->');
export const CD_START = stringToArray('<![CDATA[');
export const CD_END = stringToArray(']]>');
export const PI_START = stringToArray('<?');
export const PI_END = stringToArray('?>');
export const DOCTYPE = stringToArray('DOCTYPE');
export const PUBLIC_ID = stringToArray('PUBLIC');
export const SYSTEM_ID = stringToArray('SYSTEM');

export function stringToArray(s: string): number[] {
  return [...s].map(c => c.codePointAt(0)!);
}
export function isSpace(code: number): boolean {
  return code === 0x20 || code === 9 || code === 10 || code === 13;
}
function isCommonNameStartChar(code: number) {
  return (code >= 0x61 && code <= 0x7A) || // a-z
      (code >= 0x41 && code <= 0x5A) || // A-Z
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
export function isDigit(code: number) {
  return (code >= 0x30 && code <= 0x39);
}
export function isHexDigit(code: number) {
  return isDigit(code) ||
      (code >= 0x41 && code <= 0x46) ||
      (code >= 0x61 && code <= 0x66);
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
  'apos': [QUOTE],
  'quot': [DOUBLE_QUOTE],
  'tab': [0x09],
  'newline': [0x0A],
  'nbsp': [0x00A0],
  'ndash': [0x2013],
  'mdash': [0x2014]
}
