import {AMPERSAND, EOF, FF, GT, isAsciiLowerAlpha, isAsciiUpperAlpha, LF, LT, NUL, REPLACEMENT_CHAR, SOLIDUS, SPACE, TAB} from '../../common/code-points';
import {ParserEnvironment} from '../../decl/ParserEnvironment';
import {State} from './states';

export class CompleteParser {
  private env!: ParserEnvironment;
  private returnState!: State;

  private error(name: string) {
  }
  private emit(token: any) {
  }
  private emitCharacter(code: number) {
  }
  private emitCharacter2(code1: number, code2: number) {
  }
  private emitCharacter3(code1: number, code2: number, code3: number) {
  }
  private nextCode(): number {
    return this.env.input.next();
  }

  data(code: number): State {
    while (true) {
      switch (code) {
        case AMPERSAND:
          this.returnState = 'data';
          return 'characterReference';
        case LT:
          return 'tagOpen';
        case EOF:
          this.emit(EOF);
          return 'eof';
        case NUL:
          this.error('unexpected-null-character');
        default:
          this.emitCharacter(code);
          code = this.nextCode();
          break;
      }
    }
  }

  plaintext(code: number): State {
    while (true) {
      switch (code) {
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

  //TODO rawtext, scriptData, rcdata have very similar sequences
  private specialEndTagName(code: number, fallbackState: 'rawtext' | 'rcdata' | 'scriptData' | 'scriptDataEscaped'): State {
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
            return (this as any)[fallbackState](code) as State;
          }
      }
    }
  }

  bogusComment(code: number): State {
    // TODO emit comment
    while (true) {
      switch (code) {
        case GT:
          this.emit({type: 'comment'});
          return 'data';
        case EOF:
          this.emit({type: 'comment'});
          this.emit(EOF);
          return 'eof';
        case NUL:
          this.error('unexpected-null-character');
          code = REPLACEMENT_CHAR;
        default:
          // TODO append code
          code = this.nextCode();
      }
    }
  }

  markupDeclarationOpen(code: number): State {
    // TODO make possible to check for sequence
    return 'bogusComment';
  }

}