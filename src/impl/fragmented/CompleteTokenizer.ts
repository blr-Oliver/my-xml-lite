import {AMPERSAND, CDATA, DOCTYPE, EOF, HYPHEN, LT, NUL, OPEN_SQUARE_BRACKET, REPLACEMENT_CHAR, TWO_HYPHENS} from '../../common/code-points';
import {EOF_TOKEN} from '../tokens';
import {BaseTokenizer} from './BaseTokenizer';
import {State} from './states';

export class CompleteTokenizer extends BaseTokenizer {
  data(code: number): State {
    const buffer = this.env.buffer;
    while (true) {
      switch (code) {
        case AMPERSAND:
          this.returnState = this.state;
          this.inAttribute = false;
          return 'characterReference';
        case LT:
          return 'tagOpen';
        case EOF:
          this.emitAccumulatedCharacters();
          this.emit(EOF_TOKEN);
          return 'eof';
        case NUL:
          this.error('unexpected-null-character');
        default:
          buffer.append(code);
          code = this.nextCode();
          break;
      }
    }
  }

  plaintext(code: number): State {
    const buffer = this.env.buffer;
    while (true) {
      switch (code) {
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

  markupDeclarationOpen(code: number): State {
    // TODO deal with reconsuming the buffer when sequence fails
    switch (code) {
      case HYPHEN:
        return this.matchSequence(code, TWO_HYPHENS, false, 'comment', 'bogusComment');
      case 0x44: // D
      case 0x64: // d
        return this.matchSequence(code, DOCTYPE, true, 'doctype', 'bogusComment');
      case OPEN_SQUARE_BRACKET:
        return this.matchSequence(code, CDATA, false, 'cdataSection', 'bogusComment');
      default:
        this.emitAccumulatedCharacters();
        this.error('incorrectly-opened-comment');
        return this.bogusComment(code);
    }
  }
}