import {AMPERSAND, EOF, FF, GT, isAsciiAlpha, LF, LT, NUL, REPLACEMENT_CHAR, SOLIDUS, SPACE, TAB} from '../../common/code-points';
import {BaseTokenizer} from './BaseTokenizer';
import {State} from '../states';

export abstract class TextTokenizer extends BaseTokenizer {
  protected textEndMark!: number;

  protected textDataNoRefs(code: number, ltState: State): State {
    const buffer = this.env.buffer;
    while (true) {
      switch (code) {
        case LT:
          return ltState;
        case EOF:
          this.emitAccumulatedCharacters();
          return this.eof();
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
          return this.eof();
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

  protected textDataEndTagOpen(code: number, tagNameState: State, fallbackState: State): State {
    const buffer = this.env.buffer;
    if (isAsciiAlpha(code)) {
      this.textEndMark = buffer.position;
      buffer.append(LT);
      buffer.append(SOLIDUS);
      return this.callState(tagNameState, code);
    } else {
      buffer.append(LT);
      buffer.append(SOLIDUS);
      return this.callState(fallbackState, code);
    }
  }

  protected textDataEndTagMatched(code: number, tag: string, failedState: State): State {
    switch (code) {
      case TAB:
      case LF:
      case FF:
      case SPACE:
        this.createEndTag(tag);
        return 'beforeAttributeName';
      case SOLIDUS:
        this.createEndTag(tag);
        return 'selfClosingStartTag';
      case GT:
        this.createEndTag(tag);
        this.emitCurrentTag();
        return 'data';
      default:
        return this.callState(failedState, code);
    }
  }

  private createEndTag(tag: string): void {
    const buffer = this.env.buffer;
    buffer.position = this.textEndMark;
    this.emitAccumulatedCharacters();
    this.startNewTag(tag);
    this.currentTag.type = 'endTag';
  }
}