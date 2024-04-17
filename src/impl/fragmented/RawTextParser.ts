import {EOF, FF, GT, isAsciiAlpha, isAsciiLowerAlpha, isAsciiUpperAlpha, LF, LT, NUL, REPLACEMENT_CHAR, SOLIDUS, SPACE, TAB} from '../../common/code-points';
import {EOF_TOKEN} from '../tokens';
import {ParserBase, State} from './common';

export abstract class RawTextParser extends ParserBase {
  rawtext(code: number): State {
    const buffer = this.env.buffer;
    while (true) {
      switch (code) {
        case LT:
          return 'rawtextLessThanSign';
        case EOF:
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

  rawtextLessThanSign(code: number): State {
    const buffer = this.env.buffer;
    while (true) {
      switch (code) {
        case SOLIDUS:
          return 'rawtextEndTagOpen';
        case LT:
          buffer.append(code);
          code = this.nextCode();
          break;
        default:
          buffer.append(LT);
          return this.rawtext(code);
      }
    }
  }

  rawtextEndTagOpen(code: number): State {
    const buffer = this.env.buffer;
    if (isAsciiAlpha(code)) {
      this.emitAccumulatedCharacters();
      buffer.append(LT);
      buffer.append(SOLIDUS);
      return this.rawtextEndTagName(code);
    } else {
      buffer.append(LT);
      buffer.append(SOLIDUS);
      return this.rawtext(code);
    }
  }

  rawtextEndTagName(code: number): State {
    // TODO replace with common call
    const buffer = this.env.buffer;
    while (true) {
      switch (code) {
        case TAB:
        case LF:
        case FF:
        case SPACE:
          // TODO pass proper appropriate tag
          return this.proceedIfAppropriateTag(code, 'noscript', 'beforeAttributeName');
        case SOLIDUS:
          // TODO pass proper appropriate tag
          return this.proceedIfAppropriateTag(code, 'noscript', 'selfClosingStartTag');
        case GT:
          // TODO pass proper appropriate tag
          return this.proceedIfAppropriateTag(code, 'noscript', 'data', true);
        default:
          if (isAsciiUpperAlpha(code)) code += 0x20;
          if (isAsciiLowerAlpha(code)) {
            buffer.append(code)
            code = this.nextCode();
          } else {
            return this.rawtext(code);
          }
      }
    }
  }

  private proceedIfAppropriateTag(code: number, expectedTag: string, nextState: State, emitIfMatched: boolean = false): State {
    const buffer = this.env.buffer;
    let name = buffer.getString(2); // leading "</"
    if (name === expectedTag) {
      this.startNewTag(name);
      buffer.clear();
      if (emitIfMatched)
        this.emitCurrentTag();
      return nextState;
    } else
      return this.rawtext(code);
  }

}