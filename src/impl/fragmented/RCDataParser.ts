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
import {State} from './states';
import {ParserBase} from './ParserBase';

export abstract class RCDataParser extends ParserBase {

  rcdata(code: number): State {
    const buffer = this.env.buffer;
    while (true) {
      switch (code) {
        case AMPERSAND:
          this.returnState = 'rcdata';
          // TODO call refParser
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
    // TODO replace with common call
    const buffer = this.env.buffer;
    while (true) {
      switch (code) {
        case TAB:
        case LF:
        case FF:
        case SPACE:
          // TODO check for corresponding start tag
          if (this.startTagIfMatches('textarea'))
            return 'beforeAttributeName';
          else return this.rcdata(code);
        case SOLIDUS:
          if (this.startTagIfMatches('textarea'))
            return 'selfClosingStartTag';
          else return this.rcdata(code);
        case GT:
          if (this.startTagIfMatches('textarea', true))
            return 'data';
          else return this.rcdata(code);
        default:
          if (isAsciiUpperAlpha(code)) code += 0x20;
          if (isAsciiLowerAlpha(code)) {
            buffer.append(code);
            code = this.nextCode();
          } else return this.rcdata(code);
      }
    }
  }

}