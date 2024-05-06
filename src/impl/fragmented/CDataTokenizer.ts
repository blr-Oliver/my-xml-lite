import {CLOSE_SQUARE_BRACKET, EOF, GT} from '../../common/code-points';
import {BaseTokenizer} from './BaseTokenizer';
import {State} from './states';

export abstract class CDataTokenizer extends BaseTokenizer {
  cdataSection(code: number): State {
    const buffer = this.env.buffer;
    while (true) {
      switch (code) {
        case CLOSE_SQUARE_BRACKET:
          return 'cdataSectionBracket';
        case EOF:
          this.emitAccumulatedCharacters();
          this.error('eof-in-cdata');
          return this.eof();
        default:
          buffer.append(code);
          code = this.nextCode();
      }
    }
  }

  cdataSectionBracket(code: number): State {
    if (code === CLOSE_SQUARE_BRACKET)
      return 'cdataSectionEnd';
    else {
      this.env.buffer.append(CLOSE_SQUARE_BRACKET);
      return this.callState('cdataSection', code);
    }
  }

  cdataSectionEnd(code: number): State {
    const buffer = this.env.buffer;
    while (true) {
      switch (code) {
        case CLOSE_SQUARE_BRACKET:
          buffer.append(CLOSE_SQUARE_BRACKET);
          code = this.nextCode();
          break;
        case GT:
          this.emitAccumulatedCharacters(); // TODO this should be marked explicitly as CDATA
          return 'data';
        default:
          buffer.append(CLOSE_SQUARE_BRACKET);
          buffer.append(CLOSE_SQUARE_BRACKET);
          return this.callState('cdataSection', code);
      }
    }
  }
}