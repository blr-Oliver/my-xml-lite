import {isAsciiAlpha, isDigit} from './code-checks';
import {CodePoints} from './code-points';

function isCommonNameStartChar(code: number) {
  return isAsciiAlpha(code) ||
      code === 0x5F || // underscore (_)
      code === CodePoints.COLON;  // colon (:)
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
      code === CodePoints.HYPHEN ||
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