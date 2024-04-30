import {
  AMPERSAND,
  EOF,
  FF,
  GT,
  isAsciiAlpha,
  isAsciiLowerAlpha,
  isAsciiUpperAlpha,
  LF,
  LT,
  NUL,
  REPLACEMENT_CHAR,
  SOLIDUS,
  SPACE,
  TAB
} from '../../common/code-points';
import {BaseTokenizer} from './BaseTokenizer';
import {State} from './states';

export abstract class TextTokenizer extends BaseTokenizer {
  protected tagStartMark!: number;

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
      this.tagStartMark = buffer.position;
      buffer.append(LT);
      buffer.append(SOLIDUS);
      return this.callState(tagNameState, code);
    } else {
      buffer.append(LT);
      buffer.append(SOLIDUS);
      return this.callState(fallbackState, code);
    }
  }

  protected expectAsciiEndTag(code: number, tag: string, failedState: State): State {
    // TODO instead of tag parameter actually use last open tag
    const buffer = this.env.buffer;
    while (true) {
      switch (code) {
        case TAB:
        case LF:
        case FF:
        case SPACE:
          if (this.createEndTagIfMatches(tag, false)) return 'beforeAttributeName';
          else return this.callState(failedState, code);
        case SOLIDUS:
          if (this.createEndTagIfMatches(tag, false)) return 'selfClosingStartTag';
          else return this.callState(failedState, code);
        case GT:
          if (this.createEndTagIfMatches(tag, true)) return 'data';
          else return this.callState(failedState, code);
        default:
          if (isAsciiUpperAlpha(code)) code += 0x20;
          if (isAsciiLowerAlpha(code)) {
            buffer.append(code);
            code = this.nextCode();
          } else
            return this.callState(failedState, code);
      }
    }
  }

  private createEndTagIfMatches(expectedTag: string, emitIfMatched: boolean = false): boolean {
    const buffer = this.env.buffer;
    const name = buffer.getString(this.tagStartMark + 2);
    const matches = name === expectedTag;
    if (matches) {
      buffer.position = this.tagStartMark;
      this.emitAccumulatedCharacters();
      this.startNewTag(name);
      this.currentTag.type = 'endTag';
      if (emitIfMatched)
        this.emitCurrentTag();
      return true;
    }
    return false;
  }
}