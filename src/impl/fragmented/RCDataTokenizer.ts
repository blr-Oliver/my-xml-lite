import {State} from './states';
import {TextTokenizer} from './TextTokenizer';

export abstract class RCDataTokenizer extends TextTokenizer {
  rcdata(code: number): State {
    return this.textDataWithRefs(code, 'rcdataLessThanSign');
  }

  rcdataLessThanSign(code: number): State {
    return this.textDataLessThanSign(code, 'rcdataEndTagOpen', 'rcdata');
  }

  rcdataEndTagOpen(code: number): State {
    return this.textDataEndTagOpen(code, 'rcdataEndTagName', 'rcdata');
  }

  rcdataEndTagName(code: number): State {
    return this.expectAsciiTag(code, 'textarea', 'rcdata');
  }
}