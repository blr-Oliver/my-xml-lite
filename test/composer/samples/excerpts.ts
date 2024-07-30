import {ExcerptParams} from '../abstract-suite';

export const doctypeOnly: ExcerptParams = {
  prefixInput: '<!DOCTYPE html>',
  prefixOutput: '<!DOCTYPE html>'
};

export const foreignAttributesParams: ExcerptParams = {
  prefixInput: '<!DOCTYPE html>',
  prefixOutput: '<!DOCTYPE html><html><head></head><body>',
  suffixOutput: '</body></html>'
};

export const inTemplateParams: ExcerptParams = {
  prefixInput: '<!DOCTYPE html><html><head></head><body>',
  prefixOutput: '<!DOCTYPE html><html><head></head><body>',
  suffixOutput: '</body></html>'
};
export const formattingParams: ExcerptParams = {
  prefixInput: '<!DOCTYPE html><body>',
  suffixInput: '</body>',
  prefixOutput: '<!DOCTYPE html><html><head></head><body>',
  suffixOutput: '</body></html>'
};
export const inCaptionParams: ExcerptParams = {
  prefixInput: '<!DOCTYPE html>',
  prefixOutput: '<!DOCTYPE html><html><head></head><body>',
  suffixOutput: '</body></html>'
};
export const inCellParams: ExcerptParams = {
  prefixInput: '<!DOCTYPE html>',
  prefixOutput: '<!DOCTYPE html><html><head></head><body>',
  suffixOutput: '</body></html>'
};
export const inColumnGroupParams: ExcerptParams = {
  prefixInput: '<!DOCTYPE html>',
  prefixOutput: '<!DOCTYPE html><html><head></head><body>',
  suffixOutput: '</body></html>'
};
export const inRowParams: ExcerptParams = {
  prefixInput: '<!DOCTYPE html>',
  prefixOutput: '<!DOCTYPE html><html><head></head><body>',
  suffixOutput: '</body></html>'
};
export const inSelectParams: ExcerptParams = {
  prefixInput: '<!DOCTYPE html>',
  prefixOutput: '<!DOCTYPE html><html><head></head><body>',
  suffixOutput: '</body></html>'
};
export const inSelectInTableSpecialParams: ExcerptParams = {
  prefixInput: '<!DOCTYPE html><table>',
  suffixInput: '</table>',
  prefixOutput: '<!DOCTYPE html><html><head></head><body>',
  suffixOutput: '</body></html>'
};
export const inSelectInTableTableParams: ExcerptParams = {
  prefixInput: '<!DOCTYPE html><table>',
  suffixInput: '</table>',
  prefixOutput: '<!DOCTYPE html><html><head></head><body>',
  suffixOutput: '<table></table></body></html>',
  prefixErrors: ['unexpected-content-in-table']
};
export const inSelectInTableTdParams: ExcerptParams = {
  prefixInput: '<!DOCTYPE html><table><tbody><tr><td>',
  suffixInput: '</td></tr></tbody></table>',
  prefixOutput: '<!DOCTYPE html><html><head></head><body><table><tbody><tr><td>',
  suffixOutput: '</td></tr></tbody></table></body></html>'
};
export const inTableParams: ExcerptParams = {
  prefixInput: '<!DOCTYPE html>',
  prefixOutput: '<!DOCTYPE html><html><head></head><body>',
  suffixOutput: '</body></html>'
};
export const inTableBodyParams: ExcerptParams = {
  prefixInput: '<!DOCTYPE html>',
  prefixOutput: '<!DOCTYPE html><html><head></head><body>',
  suffixOutput: '</body></html>'
};