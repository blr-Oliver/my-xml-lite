import {State} from './states';
import {TextTokenizer} from './TextTokenizer';

export abstract class RawTextTokenizer extends TextTokenizer {
  rawtext(code: number): State {
    return this.textDataNoRefs(code, 'rawtextLessThanSign');
  }

  rawtextLessThanSign(code: number): State {
    return this.textDataLessThanSign(code, 'rawtextEndTagOpen', 'rawtext');
  }

  rawtextEndTagOpen(code: number): State {
    return this.textDataEndTagOpen(code, 'rawtextEndTagName', 'rawtext');
  }

  rawtextEndTagName(code: number): State {
    return this.expectAsciiEndTag(code, 'noscript', 'rawtext');
  }
}