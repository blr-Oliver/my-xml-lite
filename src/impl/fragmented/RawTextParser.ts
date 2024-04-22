import {EOF, isAsciiAlpha, LT, NUL, REPLACEMENT_CHAR, SOLIDUS} from '../../common/code-points';
import {EOF_TOKEN} from '../tokens';
import {ParserBase} from './ParserBase';
import {State} from './states';

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
    return this.expectAsciiTag(code, 'noscript', 'rawtext');
  }

}