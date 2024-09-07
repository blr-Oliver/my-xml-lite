import {InsertionMode} from '../src/impl/interfaces/insertion-mode.js';

export enum InsertionModeStringReversed {
  initial = InsertionMode.INITIAL,
  beforeHtml = InsertionMode.BEFORE_HTML,
  beforeHead = InsertionMode.BEFORE_HEAD,
  inHead = InsertionMode.IN_HEAD,
  inHeadNoscript = InsertionMode.IN_HEAD_NOSCRIPT,
  afterHead = InsertionMode.AFTER_HEAD,
  inBody = InsertionMode.IN_BODY,
  text = InsertionMode.TEXT,
  inTable = InsertionMode.IN_TABLE,
  inTableText = InsertionMode.IN_TABLE_TEXT,
  inCaption = InsertionMode.IN_CAPTION,
  inColumnGroup = InsertionMode.IN_COLUMN_GROUP,
  inTableBody = InsertionMode.IN_TABLE_BODY,
  inRow = InsertionMode.IN_ROW,
  inCell = InsertionMode.IN_CELL,
  inSelect = InsertionMode.IN_SELECT,
  inSelectInTable = InsertionMode.IN_SELECT_IN_TABLE,
  inTemplate = InsertionMode.IN_TEMPLATE,
  afterBody = InsertionMode.AFTER_BODY,
  inFrameset = InsertionMode.IN_FRAMESET,
  afterFrameset = InsertionMode.AFTER_FRAMESET,
  afterAfterBody = InsertionMode.AFTER_AFTER_BODY,
  afterAfterFrameset = InsertionMode.AFTER_AFTER_FRAMESET
}

export type InsertionModeReadableString = keyof typeof InsertionModeStringReversed;