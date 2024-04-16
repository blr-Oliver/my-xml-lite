import {DOUBLE_QUOTE, EOF, FF, GT, isAsciiUpperAlpha, LF, NUL, REPLACEMENT_CHAR, SINGLE_QUOTE, SPACE, TAB} from '../../common/code-points';
import {ParserBase, State} from './common';

export abstract class DoctypeParser extends ParserBase {
  doctype(code: number): State {
    switch (code) {
      case TAB:
      case LF:
      case FF:
      case SPACE:
        return 'beforeDoctypeName';
      case EOF:
        this.error('eof-in-doctype');
        this.emit({type: 'doctype', forceQuirks: true}); // TODO emit doctype
        this.emit(EOF);
        return 'eof';
      default:
        this.error('missing-whitespace-before-doctype-name');
      case GT:
        return this.beforeDoctypeName(code);
    }
  }

  beforeDoctypeName(code: number): State {
    while (true) {
      switch (code) {
        case TAB:
        case LF:
        case FF:
        case SPACE:
          code = this.nextCode();
          break;
        case GT:
          this.error('missing-doctype-name');
          this.emit({type: 'doctype', forceQuirks: true}); // TODO emit doctype
          return 'data';
        case EOF:
          this.error('eof-in-doctype');
          this.emit({type: 'doctype', forceQuirks: true}); // TODO emit doctype
          this.emit(EOF);
          return 'eof';
        case NUL:
          this.error('unexpected-null-character');
          code = REPLACEMENT_CHAR;
        default:
          if (isAsciiUpperAlpha(code)) code += 0x20;
          // TODO append to buffer
          return 'doctypeName';
      }
    }
  }

  doctypeName(code: number): State {
    while (true) {
      switch (code) {
        case TAB:
        case LF:
        case FF:
        case SPACE:
          return 'afterDoctypeName';
        case GT:
          this.emit({type: 'doctype'}); // TODO emit doctype
          return 'data';
        case EOF:
          this.error('eof-in-doctype');
          this.emit({type: 'doctype', name: '', forceQuirks: true}); // TODO emit doctype
          this.emit(EOF);
          return 'eof';
        case NUL:
          this.error('unexpected-null-character');
          code = REPLACEMENT_CHAR;
        default:
          if (isAsciiUpperAlpha(code)) code += 0x20;
          // TODO append to buffer
          code = this.nextCode();
      }
    }
  }

  afterDoctypeName(code: number): State {
    while (true) {
      switch (code) {
        case TAB:
        case LF:
        case FF:
        case SPACE:
          code = this.nextCode();
          break;
        case GT:
          this.emit({type: 'doctype'}); // TODO emit doctype
          return 'data';
        case EOF:
          this.error('eof-in-doctype');
          this.emit({type: 'doctype', name: '', forceQuirks: true}); // TODO emit doctype
          this.emit(EOF);
          return 'eof';
        default:
          // TODO make possible to check for sequence
          let sequence: string = '';
          switch (sequence) {
            case 'public':
              return 'afterDoctypePublicKeyword';
            case 'system':
              return 'afterDoctypeSystemKeyword';
            default:
              this.error('invalid-character-sequence-after-doctype-name');
              // TODO set forceQuirks -> on
              return this.bogusDoctype(code);
          }
      }
    }
  }

  afterDoctypePublicKeyword(code: number): State {
    switch (code) {
      case TAB:
      case LF:
      case FF:
      case SPACE:
        return 'beforeDoctypePublicIdentifier';
      case DOUBLE_QUOTE:
        this.error('missing-whitespace-after-doctype-public-keyword');
        // TODO set public id to empty string
        return 'doctypePublicIdentifierDoubleQuoted';
      case SINGLE_QUOTE:
        this.error('missing-whitespace-after-doctype-public-keyword');
        // TODO set public id to empty string
        return 'doctypePublicIdentifierSingleQuoted';
      case GT:
        this.error('missing-doctype-public-identifier');
        this.emit({type: 'doctype', forceQuirks: true}); // TODO emit doctype
        return 'data';
      case EOF:
        this.error('eof-in-doctype');
        this.emit({type: 'doctype', forceQuirks: true}); // TODO emit doctype
        this.emit(EOF);
        return 'eof';
      default:
        this.error('missing-quote-before-doctype-public-identifier');
        // TODO set forceQuirks -> on
        return this.bogusDoctype(code);
    }
  }

  beforeDoctypePublicIdentifier(code: number): State {
    while (true) {
      switch (code) {
        case TAB:
        case LF:
        case FF:
        case SPACE:
          code = this.nextCode();
          break;
        case DOUBLE_QUOTE:
          // TODO set public id to empty string
          return 'doctypePublicIdentifierDoubleQuoted';
        case SINGLE_QUOTE:
          // TODO set public id to empty string
          return 'doctypePublicIdentifierSingleQuoted';
        case GT:
          this.error('missing-doctype-public-identifier');
          this.emit({type: 'doctype', forceQuirks: true}); // TODO emit doctype
          return 'data';
        case EOF:
          this.error('eof-in-doctype');
          this.emit({type: 'doctype', forceQuirks: true}); // TODO emit doctype
          this.emit(EOF);
          return 'eof';
        default:
          this.error('missing-quote-before-doctype-public-identifier');
          // TODO set forceQuirks -> on
          return this.bogusDoctype(code);
      }
    }
  }

  doctypePublicIdentifierDoubleQuoted(code: number): State {
    return this.doctypePublicIdentifierQuoted(code, DOUBLE_QUOTE);
  }

  doctypePublicIdentifierSingleQuoted(code: number): State {
    return this.doctypePublicIdentifierQuoted(code, SINGLE_QUOTE);
  }

  private doctypePublicIdentifierQuoted(code: number, terminator: number): State {
    while (true) {
      switch (code) {
        case terminator:
          return 'afterDoctypePublicIdentifier';
        case GT:
          this.error('abrupt-doctype-public-identifier');
          this.emit({type: 'doctype', forceQuirks: true}); // TODO emit doctype
          return 'data';
        case EOF:
          this.error('eof-in-doctype');
          this.emit({type: 'doctype', forceQuirks: true}); // TODO emit doctype
          this.emit(EOF);
          return 'eof';
        case NUL:
          this.error('unexpected-null-character');
          code = REPLACEMENT_CHAR;
        default:
          // TODO append to buffer
          code = this.nextCode();
      }
    }
  }

  afterDoctypePublicIdentifier(code: number): State {
    switch (code) {
      case TAB:
      case LF:
      case FF:
      case SPACE:
        return 'betweenDoctypePublicAndSystemIdentifiers';
      case GT:
        this.emit({type: 'doctype'});  // TODO emit doctype
        return 'data';
      case DOUBLE_QUOTE:
        this.error('missing-whitespace-between-doctype-public-and-system-identifiers');
        // TODO set system id to empty string
        return 'doctypeSystemIdentifierDoubleQuoted';
      case SINGLE_QUOTE:
        this.error('missing-whitespace-between-doctype-public-and-system-identifiers');
        // TODO set system id to empty string
        return 'doctypeSystemIdentifierSingleQuoted';
      case EOF:
        this.error('eof-in-doctype');
        // TODO set forceQuirks -> on
        this.emit({type: 'doctype'}); // TODO emit doctype
        this.emit(EOF);
        return 'eof';
      default:
        this.error('missing-quote-before-doctype-system-identifier');
        // TODO set forceQuirks -> on
        return this.bogusDoctype(code);
    }
  }

  betweenDoctypePublicAndSystemIdentifiers(code: number): State {
    while (true) {
      switch (code) {
        case TAB:
        case LF:
        case FF:
        case SPACE:
          code = this.nextCode();
          break;
        case DOUBLE_QUOTE:
          // TODO set system id to empty string
          return 'doctypeSystemIdentifierDoubleQuoted';
        case SINGLE_QUOTE:
          // TODO set system id to empty string
          return 'doctypeSystemIdentifierSingleQuoted';
        case GT:
          this.emit({type: 'doctype'}); // TODO emit doctype
          return 'data';
        case EOF:
          this.error('eof-in-doctype');
          // TODO set forceQuirks -> on
          this.emit({type: 'doctype'}); // TODO emit doctype
          this.emit(EOF);
          return 'eof';
        default:
          this.error('missing-quote-before-doctype-system-identifier');
          // TODO set forceQuirks -> on
          return this.bogusDoctype(code);
      }
    }
  }

  afterDoctypeSystemKeyword(code: number): State {
    switch (code) {
      case TAB:
      case LF:
      case FF:
      case SPACE:
        return 'beforeDoctypeSystemIdentifier';
      case DOUBLE_QUOTE:
        this.error('missing-whitespace-after-doctype-system-keyword');
        // TODO set system id to empty string
        return 'doctypeSystemIdentifierDoubleQuoted';
      case SINGLE_QUOTE:
        this.error('missing-whitespace-after-doctype-system-keyword');
        // TODO set system id to empty string
        return 'doctypeSystemIdentifierSingleQuoted';
      case GT:
        this.error('missing-doctype-system-identifier');
        // TODO set forceQuirks -> on
        this.emit({type: 'doctype'}); // TODO emit doctype
        return 'data';
      case EOF:
        this.error('eof-in-doctype');
        // TODO set forceQuirks -> on
        this.emit({type: 'doctype'}); // TODO emit doctype
        this.emit(EOF);
        return 'eof';
      default:
        this.error('missing-quote-before-doctype-system-identifier');
        // TODO set forceQuirks -> on
        return this.bogusDoctype(code);
    }
  }

  beforeDoctypeSystemIdentifier(code: number): State {
    while (true) {
      switch (code) {
        case TAB:
        case LF:
        case FF:
        case SPACE:
          code = this.nextCode();
          break;
        case DOUBLE_QUOTE:
          // TODO set system id to empty string
          return 'doctypeSystemIdentifierDoubleQuoted';
        case SINGLE_QUOTE:
          // TODO set system id to empty string
          return 'doctypeSystemIdentifierSingleQuoted';
        case GT:
          this.error('missing-doctype-system-identifier');
          // TODO set forceQuirks -> on
          this.emit({type: 'doctype'}); // TODO emit doctype
          return 'data';
        case EOF:
          this.error('eof-in-doctype');
          // TODO set forceQuirks -> on
          this.emit({type: 'doctype'}); // TODO emit doctype
          this.emit(EOF);
          return 'eof';
        default:
          this.error('missing-quote-before-doctype-system-identifier');
          // TODO set forceQuirks -> on
          return this.bogusDoctype(code);
      }
    }
  }

  doctypeSystemIdentifierDoubleQuoted(code: number): State {
    return this.doctypeSystemIdentifierQuoted(code, DOUBLE_QUOTE);
  }
  doctypeSystemIdentifierSingleQuoted(code: number): State {
    return this.doctypeSystemIdentifierQuoted(code, SINGLE_QUOTE);
  }

  private doctypeSystemIdentifierQuoted(code: number, terminator: number): State {
    while (true) {
      switch (code) {
        case terminator:
          return 'afterDoctypeSystemIdentifier';
        case GT:
          this.error('abrupt-doctype-system-identifier');
          this.emit({type: 'doctype', forceQuirks: true}); // TODO emit doctype
          return 'data';
        case EOF:
          this.error('eof-in-doctype');
          this.emit({type: 'doctype', forceQuirks: true}); // TODO emit doctype
          this.emit(EOF);
          return 'eof';
        case NUL:
          this.error('unexpected-null-character');
          code = REPLACEMENT_CHAR;
        default:
          // TODO append to buffer
          code = this.nextCode();
      }
    }
  }

  afterDoctypeSystemIdentifier(code: number): State {
    while (true) {
      switch (code) {
        case TAB:
        case LF:
        case FF:
        case SPACE:
          code = this.nextCode();
          break;
        case GT:
          this.emit({type: 'doctype'}); // TODO emit doctype
          return 'data';
        case EOF:
          this.error('eof-in-doctype');
          this.emit({type: 'doctype', forceQuirks: true}); // TODO emit doctype
          this.emit(EOF);
          return 'eof';
        default:
          this.error('unexpected-character-after-doctype-system-identifier');
          return this.bogusDoctype(code);
      }
    }
  }

  bogusDoctype(code: number): State {
    while (true) {
      switch (code) {
        case GT:
          this.emit({type: 'doctype'}); // TODO emit doctype
          return 'data';
        case EOF:
          this.emit({type: 'doctype'}); // TODO emit doctype
          this.emit(EOF);
          return 'eof';
        case NUL:
          this.error('unexpected-null-character');
        default:
          code = this.nextCode();
      }
    }
  }
}
