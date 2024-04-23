import {AMPERSAND, EOF, isAsciiAlpha, LT, NUL, REPLACEMENT_CHAR, SOLIDUS} from '../../common/code-points';
import {EOF_TOKEN} from '../tokens';
import {ParserBase} from './ParserBase';
import {State} from './states';

export abstract class RCDataParser extends ParserBase {

  rcdata(code: number): State {
    const buffer = this.env.buffer;
    while (true) {
      switch (code) {
        case AMPERSAND:
          this.returnState = 'rcdata';
          this.isInAttribute = false;
          return 'characterReference';
        case LT:
          return 'rcdataLessThanSign';
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

  rcdataLessThanSign(code: number): State {
    const buffer = this.env.buffer;
    while (true) {
      switch (code) {
        case SOLIDUS:
          return 'rcdataEndTagOpen';
        case LT:
          buffer.append(code);
          code = this.nextCode();
          break;
        default:
          buffer.append(LT);
          return this.rcdata(code);
      }
    }
  }

  rcdataEndTagOpen(code: number): State {
    const buffer = this.env.buffer;
    if (isAsciiAlpha(code)) {
      this.emitAccumulatedCharacters();
      buffer.append(LT);
      buffer.append(SOLIDUS);
      return this.rcdataEndTagName(code);
    } else {
      buffer.append(LT);
      buffer.append(SOLIDUS);
      return this.rcdata(code);
    }
  }

  rcdataEndTagName(code: number): State {
    return this.expectAsciiTag(code, 'textarea', 'rcdata');
  }

}