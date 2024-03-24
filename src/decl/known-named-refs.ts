import {AMPERSAND, DOUBLE_QUOTE, GT, LT, SINGLE_QUOTE} from '../common/code-points';

export type EntityMapping<T> = {
  [entity: string]: T;
}

export const HTML_SPECIAL: EntityMapping<number[]> = {
  'amp;': [AMPERSAND],
  'amp': [AMPERSAND],
  'AMP;': [AMPERSAND],
  'AMP': [AMPERSAND],
  'lt;': [LT],
  'lt': [LT],
  'LT;': [LT],
  'LT': [LT],
  'gt;': [GT],
  'gt': [GT],
  'GT;': [GT],
  'GT': [GT],
  'apos;': [SINGLE_QUOTE],
  'quot;': [DOUBLE_QUOTE],
  'quot': [DOUBLE_QUOTE],
  'QUOT;': [DOUBLE_QUOTE],
  'QUOT': [DOUBLE_QUOTE]
}

