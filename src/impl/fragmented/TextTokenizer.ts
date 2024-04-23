import {AMPERSAND, EOF, isAsciiAlpha, LT, NUL, REPLACEMENT_CHAR, SOLIDUS} from '../../common/code-points';
import {EOF_TOKEN} from '../tokens';
import {BaseTokenizer} from './BaseTokenizer';
import {State} from './states';

export abstract class TextTokenizer extends BaseTokenizer {

  protected textDataNoRefs(code: number, ltState: State): State {
    const buffer = this.env.buffer;
    while (true) {
      switch (code) {
        case LT:
          return ltState;
        case EOF:
          this.emitAccumulatedCharacters();
          this.emit(EOF_TOKEN);
          return 'eof';
        case NUL:
          this.error('unexpected-null-character');
          code = REPLACEMENT_CHAR;
        default:
          buffer.append(code);
          code = this.nextCode();
          break;
      }
    }
  }

  protected textDataWithRefs(code: number, ltState: State): State {
    const buffer = this.env.buffer;
    while (true) {
      switch (code) {
        case AMPERSAND:
          this.returnState = this.state;
          this.inAttribute = false;
          return 'characterReference';
        case LT:
          return ltState;
        case EOF:
          this.emitAccumulatedCharacters();
          this.emit(EOF_TOKEN);
          return 'eof';
        case NUL:
          this.error('unexpected-null-character');
          code = REPLACEMENT_CHAR;
        default:
          buffer.append(code);
          code = this.nextCode();
          break;
      }
    }
  }

  protected textDataLessThanSign(code: number, solidusState: State, dataState: State): State {
    const buffer = this.env.buffer;
    while (true) {
      switch (code) {
        case SOLIDUS:
          return solidusState;
        case LT:
          buffer.append(code);
          code = this.nextCode();
          break;
        default:
          buffer.append(LT);
          return this.callState(dataState, code);
      }
    }
  }

  protected textDataEndTagOpen(code: number, tagNameState: State, dataState: State): State {
    const buffer = this.env.buffer;
    if (isAsciiAlpha(code)) {
      this.emitAccumulatedCharacters();
      buffer.append(LT);
      buffer.append(SOLIDUS);
      return this.callState(tagNameState, code);
    } else {
      buffer.append(LT);
      buffer.append(SOLIDUS);
      return this.callState(dataState, code);
    }
  }
}