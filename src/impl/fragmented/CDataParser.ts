import {CLOSE_SQUARE_BRACKET, EOF, GT} from '../../common/code-points';
import {ParserBase, State} from './common';

export abstract class CDataParser extends ParserBase {
  cdataSection(code: number): State {
    while (true) {
      switch (code) {
        case CLOSE_SQUARE_BRACKET:
          return 'cdataSectionBracket';
        case EOF:
          this.error('eof-in-cdata');
          this.emit(EOF);
          return 'eof';
        default:
          this.emitCharacter(code);
          code = this.nextCode();
      }
    }
  }

  cdataSectionBracket(code: number): State {
    if (code === CLOSE_SQUARE_BRACKET)
      return 'cdataSectionEnd';
    else {
      this.emitCharacter(CLOSE_SQUARE_BRACKET);
      return this.cdataSection(code);
    }
  }

  cdataSectionEnd(code: number): State {
    while (true) {
      switch (code) {
        case CLOSE_SQUARE_BRACKET:
          this.emitCharacter(CLOSE_SQUARE_BRACKET);
          code = this.nextCode();
          break;
        case GT:
          return 'data';
        default:
          this.emitCharacter(CLOSE_SQUARE_BRACKET);
          return this.cdataSection(code);
      }
    }
  }
}