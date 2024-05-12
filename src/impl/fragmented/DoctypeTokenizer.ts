import {DOUBLE_QUOTE, EOF, FF, GT, isAsciiUpperAlpha, LF, NUL, REPLACEMENT_CHAR, SINGLE_QUOTE, SPACE, TAB} from '../../common/code-points';
import {DoctypeToken} from '../tokens';
import {BaseTokenizer} from './BaseTokenizer';
import {State} from './states';

const PUBLIC: number[] = [0x70, 0x75, 0x62, 0x6C, 0x69, 0x63] as const;
const SYSTEM: number[] = [0x73, 0x79, 0x73, 0x74, 0x65, 0x6D] as const;

export abstract class DoctypeTokenizer extends BaseTokenizer {
  private currentDoctype!: DoctypeToken;

  doctype(code: number): State {
    this.env.buffer.position = this.sequenceBufferOffset;
    this.emitAccumulatedCharacters();
    this.startNewDoctype();
    switch (code) {
      case TAB:
      case LF:
      case FF:
      case SPACE:
        return 'beforeDoctypeName';
      case EOF:
        return this.eofInDoctype();
      default:
        this.error('missing-whitespace-before-doctype-name');
      case GT:
        return this.callState('beforeDoctypeName', code);
    }
  }

  beforeDoctypeName(code: number): State {
    const buffer = this.env.buffer;
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
          this.currentDoctype.forceQuirks = true;
          this.emitCurrentDoctype();
          return 'data';
        case EOF:
          return this.eofInDoctype();
        case NUL:
          this.error('unexpected-null-character');
          code = REPLACEMENT_CHAR;
        default:
          if (isAsciiUpperAlpha(code)) code += 0x20;
          buffer.append(code);
          return 'doctypeName';
      }
    }
  }

  doctypeName(code: number): State {
    const buffer = this.env.buffer;
    while (true) {
      switch (code) {
        case TAB:
        case LF:
        case FF:
        case SPACE:
          this.currentDoctype.name = buffer.takeString();
          return 'afterDoctypeName';
        case GT:
          this.currentDoctype.name = buffer.takeString();
          this.emitCurrentDoctype();
          return 'data';
        case EOF:
          this.currentDoctype.name = buffer.takeString();
          return this.eofInDoctype();
        case NUL:
          this.error('unexpected-null-character');
          code = REPLACEMENT_CHAR;
        default:
          if (isAsciiUpperAlpha(code)) code += 0x20;
          buffer.append(code);
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
          this.emitCurrentDoctype();
          return 'data';
        case EOF:
          return this.eofInDoctype();
        case 0x50: // P
        case 0x70: // p
          return this.matchSequence(code, PUBLIC, true, 'afterDoctypePublicKeyword', 'afterDoctypeNameFailedSequence');
        case 0x53: // S
        case 0x73: // s
          return this.matchSequence(code, SYSTEM, true, 'afterDoctypeSystemKeyword', 'afterDoctypeNameFailedSequence');
        default:
          return this.callState('afterDoctypeNameFailedSequence', code);
      }
    }
  }

  afterDoctypeNameFailedSequence(code: number): State {
    this.env.buffer.position = this.sequenceBufferOffset;
    this.currentDoctype.forceQuirks = true;
    this.error('invalid-character-sequence-after-doctype-name');
    return this.callState('bogusDoctype', code);
  }

  afterDoctypePublicKeyword(code: number): State {
    this.env.buffer.position = this.sequenceBufferOffset;
    switch (code) {
      case TAB:
      case LF:
      case FF:
      case SPACE:
        return 'beforeDoctypePublicIdentifier';
      case DOUBLE_QUOTE:
        this.error('missing-whitespace-after-doctype-public-keyword');
        return 'doctypePublicIdentifierDoubleQuoted';
      case SINGLE_QUOTE:
        this.error('missing-whitespace-after-doctype-public-keyword');
        return 'doctypePublicIdentifierSingleQuoted';
      case GT:
        this.currentDoctype.forceQuirks = true;
        this.error('missing-doctype-public-identifier');
        this.emitCurrentDoctype();
        return 'data';
      case EOF:
        return this.eofInDoctype();
      default:
        this.currentDoctype.forceQuirks = true;
        this.error('missing-quote-before-doctype-public-identifier');
        return this.callState('bogusDoctype', code);
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
          return 'doctypePublicIdentifierDoubleQuoted';
        case SINGLE_QUOTE:
          return 'doctypePublicIdentifierSingleQuoted';
        case GT:
          this.currentDoctype.forceQuirks = true;
          this.error('missing-doctype-public-identifier');
          this.emitCurrentDoctype();
          return 'data';
        case EOF:
          return this.eofInDoctype();
        default:
          this.currentDoctype.forceQuirks = true;
          this.error('missing-quote-before-doctype-public-identifier');
          return this.callState('bogusDoctype', code);
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
    const buffer = this.env.buffer;
    while (true) {
      switch (code) {
        case terminator:
          this.currentDoctype.publicId = buffer.takeString();
          return 'afterDoctypePublicIdentifier';
        case GT:
          this.currentDoctype.publicId = buffer.takeString();
          this.currentDoctype.forceQuirks = true;
          this.error('abrupt-doctype-public-identifier');
          this.emitCurrentDoctype();
          return 'data';
        case EOF:
          this.currentDoctype.publicId = buffer.takeString();
          return this.eofInDoctype();
        case NUL:
          this.error('unexpected-null-character');
          code = REPLACEMENT_CHAR;
        default:
          buffer.append(code);
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
        this.emitCurrentDoctype();
        return 'data';
      case DOUBLE_QUOTE:
        this.error('missing-whitespace-between-doctype-public-and-system-identifiers');
        return 'doctypeSystemIdentifierDoubleQuoted';
      case SINGLE_QUOTE:
        this.error('missing-whitespace-between-doctype-public-and-system-identifiers');
        return 'doctypeSystemIdentifierSingleQuoted';
      case EOF:
        return this.eofInDoctype();
      default:
        this.currentDoctype.forceQuirks = true;
        this.error('missing-quote-before-doctype-system-identifier');
        return this.callState('bogusDoctype', code);
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
          return 'doctypeSystemIdentifierDoubleQuoted';
        case SINGLE_QUOTE:
          return 'doctypeSystemIdentifierSingleQuoted';
        case GT:
          this.emitCurrentDoctype();
          return 'data';
        case EOF:
          return this.eofInDoctype();
        default:
          this.currentDoctype.forceQuirks = true;
          this.error('missing-quote-before-doctype-system-identifier');
          return this.callState('bogusDoctype', code);
      }
    }
  }

  afterDoctypeSystemKeyword(code: number): State {
    this.env.buffer.position = this.sequenceBufferOffset;
    switch (code) {
      case TAB:
      case LF:
      case FF:
      case SPACE:
        return 'beforeDoctypeSystemIdentifier';
      case DOUBLE_QUOTE:
        this.error('missing-whitespace-after-doctype-system-keyword');
        return 'doctypeSystemIdentifierDoubleQuoted';
      case SINGLE_QUOTE:
        this.error('missing-whitespace-after-doctype-system-keyword');
        return 'doctypeSystemIdentifierSingleQuoted';
      case GT:
        this.currentDoctype.forceQuirks = true;
        this.error('missing-doctype-system-identifier');
        this.emitCurrentDoctype();
        return 'data';
      case EOF:
        return this.eofInDoctype();
      default:
        this.currentDoctype.forceQuirks = true;
        this.error('missing-quote-before-doctype-system-identifier');
        return this.callState('bogusDoctype', code);
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
          return 'doctypeSystemIdentifierDoubleQuoted';
        case SINGLE_QUOTE:
          return 'doctypeSystemIdentifierSingleQuoted';
        case GT:
          this.currentDoctype.forceQuirks = true;
          this.error('missing-doctype-system-identifier');
          this.emitCurrentDoctype();
          return 'data';
        case EOF:
          return this.eofInDoctype();
        default:
          this.currentDoctype.forceQuirks = true;
          this.error('missing-quote-before-doctype-system-identifier');
          return this.callState('bogusDoctype', code);
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
    const buffer = this.env.buffer;
    while (true) {
      switch (code) {
        case terminator:
          this.currentDoctype.systemId = buffer.takeString();
          return 'afterDoctypeSystemIdentifier';
        case GT:
          this.currentDoctype.systemId = buffer.takeString();
          this.currentDoctype.forceQuirks = true;
          this.error('abrupt-doctype-system-identifier');
          this.emitCurrentDoctype();
          return 'data';
        case EOF:
          this.currentDoctype.systemId = buffer.takeString();
          return this.eofInDoctype();
        case NUL:
          this.error('unexpected-null-character');
          code = REPLACEMENT_CHAR;
        default:
          buffer.append(code);
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
          this.emitCurrentDoctype();
          return 'data';
        case EOF:
          return this.eofInDoctype();
        default:
          this.error('unexpected-character-after-doctype-system-identifier');
          return this.callState('bogusDoctype', code);
      }
    }
  }

  bogusDoctype(code: number): State {
    while (true) {
      switch (code) {
        case GT:
          this.emitCurrentDoctype()
          return 'data';
        case EOF:
          this.emitCurrentDoctype();
          return this.eof();
        case NUL:
          this.error('unexpected-null-character');
        default:
          code = this.nextCode();
      }
    }
  }

  private startNewDoctype(forceQuirks: boolean = false) {
    this.currentDoctype = {
      type: 'doctype',
      name: undefined,
      publicId: undefined,
      systemId: undefined,
      forceQuirks
    };
  }

  private emitCurrentDoctype() {
    this.emit(this.currentDoctype);
    // @ts-ignore
    this.currentDoctype = undefined;
  }

  private eofInDoctype(): State {
    this.currentDoctype.forceQuirks = true;
    this.error('eof-in-doctype');
    this.emitCurrentDoctype();
    return this.eof();
  }
}
