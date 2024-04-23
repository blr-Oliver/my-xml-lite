import {AMPERSAND, EOF, GT, LT, NUL, REPLACEMENT_CHAR} from '../../common/code-points';
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

  bogusComment(code: number): State {
    const buffer = this.env.buffer;
    while (true) {
      switch (code) {
        case GT:
          this.emit({type: 'comment', data: buffer.takeString()});
          return 'data';
        case EOF:
          this.emit({type: 'comment', data: buffer.takeString()});
          this.emit(EOF_TOKEN);
          return 'eof';
        case NUL:
          this.error('unexpected-null-character');
          code = REPLACEMENT_CHAR;
        default:
          buffer.append(code);
          code = this.nextCode();
      }
    }
  }

  markupDeclarationOpen(code: number): State {
    // TODO make possible to check for sequence
    return 'bogusComment';
  }

}