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

  protected expectAsciiTag(code: number, tag: string, failedState: State): State {
    // TODO instead of tag parameter actually use last open tag
    const buffer = this.env.buffer;
    const mark = buffer.position;
    while (true) {
      switch (code) {
        case TAB:
        case LF:
        case FF:
        case SPACE:
          if (this.startTagIfMatches(tag, false, mark)) return 'beforeAttributeName';
          else return this.callState(failedState, code);
        case SOLIDUS:
          if (this.startTagIfMatches(tag, false, mark)) return 'selfClosingStartTag';
          else return this.callState(failedState, code);
        case GT:
          if (this.startTagIfMatches(tag, false, mark)) return 'data';
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

  private startTagIfMatches(expectedTag: string, emitIfMatched: boolean = false, fromPosition: number): boolean {
    const buffer = this.env.buffer;
    const name = buffer.getString(fromPosition);
    const matches = name === expectedTag;
    if (matches) {
      this.emitAccumulatedCharacters();
      this.startNewTag(name);
      buffer.clear();
      if (emitIfMatched)
        this.emitCurrentTag();
      return true;
    }
    return false;
  }
}