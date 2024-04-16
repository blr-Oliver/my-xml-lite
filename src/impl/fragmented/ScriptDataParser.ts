import {
  EOF,
  EXCLAMATION,
  FF,
  GT,
  HYPHEN,
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

export abstract class ScriptDataParser extends ParserBase {
  scriptData(code: number): State {
    while (true) {
      switch (code) {
        case LT:
          return 'scriptDataLessThanSign';
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

  scriptDataLessThanSign(code: number): State {
    switch (code) {
      case SOLIDUS:
        // TODO reset buffer
        return 'scriptDataEndTagOpen';
      case EXCLAMATION:
        this.emitCharacter2(LT, EXCLAMATION);
        return 'scriptDataEscapeStart';
      default:
        this.emitCharacter(LT);
        return this.scriptData(code);
    }
  }

  scriptDataEndTagOpen(code: number): State {
    if (isAsciiAlpha(code)) {
      // TODO create new tag token
      return this.scriptDataEndTagName(code);
    } else {
      this.emitCharacter2(LT, SOLIDUS);
      return this.scriptData(code);
    }
  }

  scriptDataEndTagName(code: number): State {
    // TODO replace with common call
    // return this.specialEndTagName(code, 'scriptData');
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
            return this.scriptData(code);
          }
      }
    }
  }
  scriptDataEscapeStart(code: number): State {
    if (code === HYPHEN) {
      this.emitCharacter(HYPHEN);
      return 'scriptDataEscapeStartDash';
    } else
      return this.scriptData(code);
  }

  scriptDataEscapeStartDash(code: number): State {
    if (code === HYPHEN) {
      this.emitCharacter(HYPHEN);
      return 'scriptDataEscapedDashDash';
    } else
      return this.scriptData(code);
  }

  scriptDataEscaped(code: number): State {
    while (true) {
      switch (code) {
        case HYPHEN:
          this.emitCharacter(HYPHEN);
          return 'scriptDataEscapedDash';
        case LT:
          return 'scriptDataEscapedLessThanSign';
        case EOF:
          this.error('eof-in-script-html-comment-like-text');
          this.emit(EOF);
          return 'eof';
        case NUL:
          this.error('unexpected-null-character');
          code = REPLACEMENT_CHAR;
        default:
          this.emitCharacter(code);
          code = this.nextCode();
      }
    }
  }

  scriptDataEscapedDash(code: number): State {
    switch (code) {
      case HYPHEN:
        this.emitCharacter(HYPHEN);
        return 'scriptDataEscapedDashDash';
      case LT:
        return 'scriptDataEscapedLessThanSign';
      case EOF:
        this.error('eof-in-script-html-comment-like-text');
        this.emit(EOF);
        return 'eof';
      case NUL:
        this.error('unexpected-null-character');
        code = REPLACEMENT_CHAR;
      default:
        this.emitCharacter(code);
        return 'scriptDataEscaped';
    }
  }

  scriptDataEscapedDashDash(code: number): State {
    while (true) {
      switch (code) {
        case HYPHEN:
          this.emitCharacter(HYPHEN);
          code = this.nextCode();
          break;
        case LT:
          return 'scriptDataEscapedLessThanSign';
        case GT:
          this.emitCharacter(GT);
          return 'scriptData';
        case EOF:
          this.error('eof-in-script-html-comment-like-text');
          this.emit(EOF);
          return 'eof';
        case NUL:
          this.error('unexpected-null-character');
          code = REPLACEMENT_CHAR;
        default:
          this.emitCharacter(code);
          return 'scriptDataEscaped';
      }
    }
  }

  scriptDataEscapedLessThanSign(code: number): State {
    if (code === SOLIDUS) {
      // TODO reset buffer
      return 'scriptDataEscapedEndTagOpen';
    } else if (isAsciiAlpha(code)) {
      // TODO reset buffer
      return this.scriptDataDoubleEscapeStart(code);
    } else {
      this.emitCharacter(LT);
      return this.scriptDataEscaped(code);
    }
  }

  scriptDataEscapedEndTagOpen(code: number): State {
    if (isAsciiAlpha(code)) {
      // TODO create tag token
      return this.scriptDataEscapedEndTagName(code);
    } else {
      this.emitCharacter2(LT, SOLIDUS);
      return this.scriptDataEscaped(code);
    }
  }

  scriptDataEscapedEndTagName(code: number): State {
    // TODO replace with common call
    // return this.specialEndTagName(code, 'scriptData');
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
            return this.scriptDataEscaped(code);
          }
      }
    }
  }

  scriptDataDoubleEscapeStart(code: number): State {
    while (true) {
      switch (code) {
        case TAB:
        case LF:
        case FF:
        case SPACE:
        case SOLIDUS:
        case GT:
          this.emitCharacter(code);
          let isScript: boolean = true; // TODO check for buffer content to be "script"
          if (isScript) {
            return 'scriptDataDoubleEscaped';
          } else {
            return 'scriptDataEscaped';
          }
        default:
          if (isAsciiUpperAlpha(code)) code += 0x20;
          if (isAsciiLowerAlpha(code)) {
            // TODO append current code
            this.emitCharacter(code);
            code = this.nextCode();
          } else {
            return this.scriptDataEscaped(code);
          }
      }
    }
  }

  scriptDataDoubleEscaped(code: number): State {
    while (true) {
      switch (code) {
        case HYPHEN:
          this.emitCharacter(HYPHEN);
          return 'scriptDataDoubleEscapedDash';
        case LT:
          this.emitCharacter(LT);
          return 'scriptDataDoubleEscapedLessThanSign';
        case EOF:
          this.error('eof-in-script-html-comment-like-text');
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

  scriptDataDoubleEscapedDash(code: number): State {
    switch (code) {
      case HYPHEN:
        this.emitCharacter(HYPHEN);
        return 'scriptDataDoubleEscapedDashDash';
      case LT:
        this.emitCharacter(LT);
        return 'scriptDataDoubleEscapedLessThanSign';
      case NUL:
        this.error('unexpected-null-character');
        this.emitCharacter(REPLACEMENT_CHAR);
        return 'scriptDataDoubleEscaped';
      case EOF:
        this.error('eof-in-script-html-comment-like-text');
        this.emit(EOF);
        return 'eof';
      default:
        this.emitCharacter(code);
        return 'scriptDataDoubleEscaped';
    }
  }

  scriptDataDoubleEscapedDashDash(code: number): State {
    while (true) {
      switch (code) {
        case HYPHEN:
          this.emitCharacter(HYPHEN);
          code = this.nextCode();
          break;
        case LT:
          this.emitCharacter(LT);
          return 'scriptDataDoubleEscapedLessThanSign';
        case GT:
          this.emitCharacter(GT);
          return 'scriptData';
        case NUL:
          this.error('unexpected-null-character');
          this.emitCharacter(REPLACEMENT_CHAR);
          return 'scriptDataDoubleEscaped';
        case EOF:
          this.error('eof-in-script-html-comment-like-text');
          this.emit(EOF);
          return 'eof';
        default:
          this.emitCharacter(code);
          return 'scriptDataDoubleEscaped';
      }
    }
  }

  scriptDataDoubleEscapedLessThanSign(code: number): State {
    if (code === SOLIDUS) {
      // TODO reset buffer
      this.emitCharacter(SOLIDUS);
      return 'scriptDataDoubleEscapeEnd';
    } else {
      return this.scriptDataDoubleEscaped(code);
    }
  }

  scriptDataDoubleEscapeEnd(code: number): State {
    while (true) {
      switch (code) {
        case TAB:
        case LF:
        case FF:
        case SPACE:
        case SOLIDUS:
        case GT:
          this.emitCharacter(code);
          let isScript: boolean = true; // TODO check for buffer content to be "script"
          if (isScript) {
            return 'scriptDataEscaped';
          } else {
            return 'scriptDataDoubleEscaped';
          }
        default:
          if (isAsciiUpperAlpha(code)) code += 0x20;
          if (isAsciiLowerAlpha(code)) {
            // TODO append current code
            this.emitCharacter(code);
            code = this.nextCode();
          } else {
            return this.scriptDataDoubleEscaped(code);
          }
      }
    }
  }
}