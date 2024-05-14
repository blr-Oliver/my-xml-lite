export type CharCodePredicate = (code: number) => boolean;

export function range(lo: number, hi: number, loInclusive: boolean = true, hiInclusive: boolean = true): CharCodePredicate {
  return loInclusive ?
      (hiInclusive ? code => lo <= code && code <= hi : code => lo <= code && code < hi) :
      (hiInclusive ? code => lo < code && code <= hi : code => lo < code && code < hi);
}
export function or(...predicates: CharCodePredicate[]): CharCodePredicate {
  return code => predicates.some(p => p(code));
}

export const isSpace = (code: number) => code === 0x20 || code === 9 || code === 10 || code === 13 || code === 12;
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
export const isNonCharacter = (code: number) => ((code & 0xFFFE) === 0xFFFE) || (code >= 0xFDD0 && code <= 0xFDEF);
