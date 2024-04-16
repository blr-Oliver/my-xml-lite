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
import {ParserBase, State} from './common';

export abstract class RCDataParser extends ParserBase {

  rcdata(code: number): State {
    while (true) {
      switch (code) {
        case AMPERSAND:
          this.returnState = 'rcdata';
          return 'characterReference';
        case LT:
          return 'rcdataLessThanSign';
        case EOF:
          this.emit(EOF);
          return 'eof';
        case NUL:
          this.error('unexpected-null-character');
          code = REPLACEMENT_CHAR;
        default:
          this.emitCharacter(code);
          code = this.nextCode();
          break;
      }
    }
  }
  rcdataLessThanSign(code: number): State {
    switch (code) {
      case SOLIDUS:
        // TODO reset buffer
        return 'rcdataEndTagOpen';
      default:
        this.emitCharacter(LT);
        return this.rcdata(code);
    }
  }

  rcdataEndTagOpen(code: number): State {
    if (isAsciiAlpha(code)) {
      // TODO create tag token
      return this.rcdataEndTagName(code);
    } else {
      this.emitCharacter2(LT, SOLIDUS);
      return this.rcdata(code);
    }
  }

  rcdataEndTagName(code: number): State {
    // TODO replace with common call
    // return this.specialEndTagName(code, 'rcdata');
    while (true) {
      switch (code) {
        case TAB:
        case LF:
        case FF:
        case SPACE:
          // TODO check for corresponding start tag
          return 'beforeAttributeName';
        case SOLIDUS:
          return 'selfClosingStartTag';
        case GT:
          // TODO check for corresponding start tag
          // TODO create tag token
          this.emit({type: 'tag'});
          return 'data';
        default:
          if (isAsciiUpperAlpha(code)) code += 0x20;
          if (isAsciiLowerAlpha(code)) {
            // TODO append current code
            code = this.nextCode();
          } else {
            this.emitCharacter2(LT, SOLIDUS);
            // TODO emit current buffer as text
            return this.rcdata(code);
          }
      }
    }
  }

}