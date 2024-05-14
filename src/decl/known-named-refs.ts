import {CodePoints} from '../common/code-points';

export type EntityMapping<T> = {
  [entity: string]: T;
}

export const HTML_SPECIAL: EntityMapping<number[]> = {
  'amp;': [CodePoints.AMPERSAND],
  'amp': [CodePoints.AMPERSAND],
  'AMP;': [CodePoints.AMPERSAND],
  'AMP': [CodePoints.AMPERSAND],
  'lt;': [CodePoints.LT],
  'lt': [CodePoints.LT],
  'LT;': [CodePoints.LT],
  'LT': [CodePoints.LT],
  'gt;': [CodePoints.GT],
  'gt': [CodePoints.GT],
  'GT;': [CodePoints.GT],
  'GT': [CodePoints.GT],
  'apos;': [CodePoints.APOSTROPHE],
  'quot;': [CodePoints.QUOTE],
  'quot': [CodePoints.QUOTE],
  'QUOT;': [CodePoints.QUOTE],
  'QUOT': [CodePoints.QUOTE]
}

