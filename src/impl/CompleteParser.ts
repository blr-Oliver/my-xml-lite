import {
  AMPERSAND,
  CLOSE_SQUARE_BRACKET,
  DOUBLE_QUOTE,
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
  QUESTION,
  REPLACEMENT_CHAR,
  SINGLE_QUOTE,
  SOLIDUS,
  SPACE,
  TAB
} from '../common/code-points';
import {ParserEnvironment} from '../decl/ParserEnvironment';


type State =
    'data' |
    'rcdata' |
    'rawtext' |
    'scriptData' |
    'plaintext' |
    'tagOpen' |
    'endTagOpen' |
    'tagName' |
    'rcdataLessThanSign' |
    'rcdataEndTagOpen' |
    'rcdataEndTagName' |
    'rawtextLessThanSign' |
    'rawtextEndTagOpen' |
    'rawtextEndTagName' |
    'scriptDataLessThanSign' |
    'scriptDataEndTagOpen' |
    'scriptDataEndTagName' |
    'scriptDataEscapeStart' |
    'scriptDataEscapeStartDash' |
    'scriptDataEscaped' |
    'scriptDataEscapedDash' |
    'scriptDataEscapedDashDash' |
    'scriptDataEscapedLessThanSign' |
    'scriptDataEscapedEndTagOpen' |
    'scriptDataEscapedEndTagName' |
    'scriptDataDoubleEscapeStart' |
    'scriptDataDoubleEscaped' |
    'scriptDataDoubleEscapedDash' |
    'scriptDataDoubleEscapedDashDash' |
    'scriptDataDoubleEscapedLessThanSign' |
    'scriptDataDoubleEscapeEnd' |
    'beforeAttributeName' |
    'attributeName' |
    'afterAttributeName' |
    'beforeAttributeValue' |
    'attributeValue(doubleQuoted)' |
    'attributeValue(singleQuoted)' |
    'attributeValue(unquoted)' |
    'afterAttributeValue(quoted)' |
    'selfClosingStartTag' |
    'bogusComment' |
    'markupDeclarationOpen' |
    'commentStart' |
    'commentStartDash' |
    'comment' |
    'commentLessThanSign' |
    'commentLessThanSignBang' |
    'commentLessThanSignBangDash' |
    'commentLessThanSignBangDashDash' |
    'commentEndDash' |
    'commentEnd' |
    'commentEndBang' |
    'doctype' |
    'beforeDoctypeName' |
    'doctypeName' |
    'afterDoctypeName' |
    'afterDoctypePublicKeyword' |
    'beforeDoctypePublicIdentifier' |
    'doctypePublicIdentifierDoubleQuoted' |
    'doctypePublicIdentifierSingleQuoted' |
    'afterDoctypePublicIdentifier' |
    'betweenDoctypePublicAndSystemIdentifiers' |
    'afterDoctypeSystemKeyword' |
    'beforeDoctypeSystemIdentifier' |
    'doctypeSystemIdentifierDoubleQuoted' |
    'doctypeSystemIdentifierSingleQuoted' |
    'afterDoctypeSystemIdentifier' |
    'bogusDoctype' |
    'cdataSection' |
    'cdataSectionBracket' |
    'cdataSectionEnd' |
    'characterReference' |
    'namedCharacterReference' |
    'ambiguousAmpersand' |
    'numericCharacterReference' |
    'hexadecimalCharacterReferenceStart' |
    'decimalCharacterReferenceStart' |
    'hexadecimalCharacterReference' |
    'decimalCharacterReference' |
    'numericCharacterReferenceEnd' |
    'eof' |
    'eoc';

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

  rawtext(code: number): State {
    while (true) {
      switch (code) {
        case LT:
          return 'rawtextLessThanSign';
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

  tagOpen(code: number): State {
    switch (code) {
      case EXCLAMATION:
        return 'markupDeclarationOpen';
      case SOLIDUS:
        return 'endTagOpen';
      case QUESTION:
        this.error('unexpected-question-mark-instead-of-tag-name');
        //TODO create comment token
        return this.bogusComment(code);
      case EOF:
        this.error('eof-before-tag-name');
        this.emitCharacter(LT);
        this.emit(EOF);
        return 'eof';
      default:
        if (isAsciiAlpha(code)) {
          //TODO create tag token
          return this.tagName(code);
        } else {
          this.error('invalid-first-character-of-tag-name');
          this.emitCharacter(LT);
          return this.data(code);
        }
    }
  }

  endTagOpen(code: number): State {
    switch (code) {
      case GT:
        this.error('missing-end-tag-name');
        return 'data';
      case EOF:
        this.error('eof-before-tag-name');
        this.emitCharacter2(LT, SOLIDUS);
        this.emit(EOF);
        return 'eof';
      default:
        if (isAsciiAlpha(code)) {
          //TODO create tag token
          return this.tagName(code);
        } else {
          this.error('invalid-first-character-of-tag-name');
          return this.bogusComment(code);
        }
    }
  }

  tagName(code: number): State {
    while (true) {
      switch (code) {
        case TAB:
        case LF:
        case FF:
        case SPACE:
          return 'beforeAttributeName';
        case SOLIDUS:
          return 'selfClosingStartTag';
        case GT:
          // TODO create tag token
          this.emit({type: 'tag'});
          return 'data';
        case EOF:
          this.error('eof-in-tag');
          this.emit(EOF);
          return 'eof';
        case NUL:
          this.error('unexpected-null-character');
          code = REPLACEMENT_CHAR;
        default:
          if (isAsciiUpperAlpha(code)) code += 0x20;
          // TODO append current code
          code = this.nextCode();
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

  rawtextLessThanSign(code: number): State {
    if (code === SOLIDUS) {
      // TODO reset buffer
      return 'rawtextEndTagOpen';
    } else {
      this.emitCharacter(LT);
      return this.rawtext(code);
    }
  }

  rawtextEndTagOpen(code: number): State {
    if (isAsciiAlpha(code)) {
      // TODO create tag token
      return this.rawtextEndTagName(code);
    } else {
      this.emitCharacter2(LT, SOLIDUS);
      return this.rawtext(code);
    }
  }

  rawtextEndTagName(code: number): State {
    // TODO replace with common call
    // return this.specialEndTagName(code, 'rawtext');
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
            return this.rawtext(code);
          }
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

  //TODO rawtext, scriptData, rcdata have very similar sequences

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
            return this[fallbackState](code);
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

  commentStart(code: number): State {
    switch (code) {
      case HYPHEN:
        return 'commentStartDash';
      case GT:
        this.error('abrupt-closing-of-empty-comment');
        this.emit({type: 'comment'}); // TODO emit comment
        return 'data';
      default:
        return this.comment(code);
    }
  }

  commentStartDash(code: number): State {
    switch (code) {
      case HYPHEN:
        return 'commentEnd';
      case GT:
        this.error('abrupt-closing-of-empty-comment');
        this.emit({type: 'comment'}); // TODO emit comment
        return 'data';
      case EOF:
        this.error('eof-in-comment');
        this.emit({type: 'comment'}); // TODO emit comment
        this.emit(EOF);
        return 'eof';
      default:
        // TODO append HYPHEN to current comment
        return this.comment(code);
    }
  }

  comment(code: number): State {
    while (true) {
      switch (code) {
        case LT:
          // TODO append to buffer
          return 'commentLessThanSign';
        case HYPHEN:
          return 'commentEndDash';
        case EOF:
          this.error('eof-in-comment');
          this.emit({type: 'comment'}); // TODO emit comment
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

  commentLessThanSign(code: number): State {
    while (true) {
      switch (code) {
        case EXCLAMATION:
          // TODO append to buffer
          return 'commentLessThanSignBang';
        case LT:
          // TODO append to buffer
          code = this.nextCode();
          break;
        default:
          return this.comment(code);
      }
    }
  }

  commentLessThanSignBang(code: number): State {
    if (code === HYPHEN)
      return 'commentLessThanSignBangDash';
    else
      return this.comment(code);
  }

  commentLessThanSignBangDash(code: number): State {
    if (code === HYPHEN)
      return 'commentLessThanSignBangDashDash';
    else
      return this.commentEndDash(code);
  }

  commentLessThanSignBangDashDash(code: number): State {
    if (code !== GT && code !== EOF)
      this.error('nested-comment');
    return this.commentEnd(code);
  }

  commentEndDash(code: number): State {
    switch (code) {
      case HYPHEN:
        return 'commentEnd';
      case EOF:
        this.error('eof-in-comment');
        this.emit({type: 'comment'}); // TODO emit comment
        this.emit(EOF);
        return 'eof';
      default:
        // TODO append HYPHEN
        return this.comment(code);
    }
  }

  commentEnd(code: number): State {
    while (true) {
      switch (code) {
        case GT:
          this.emit({type: 'comment'}); // TODO emit comment;
          return 'data';
        case EXCLAMATION:
          return 'commentEndBang';
        case EOF:
          this.error('eof-in-comment');
          this.emit({type: 'comment'}); // TODO emit comment
          this.emit(EOF);
          return 'eof';
        case HYPHEN:
          // TODO append HYPHEN
          code = this.nextCode();
          break;
        default:
          // TODO append HYPHEN
          return this.comment(code);
      }
    }
  }

  commentEndBang(code: number): State {
    switch (code) {
      case HYPHEN:
        // TODO append to buffer: --!
        return 'commentEndDash';
      case GT:
        this.error('incorrectly-closed-comment');
        this.emit({type: 'comment'}); // TODO emit comment;
        return 'data';
      case EOF:
        this.error('eof-in-comment');
        this.emit({type: 'comment'}); // TODO emit comment
        this.emit(EOF);
        return 'eof';
      default:
        // TODO append to buffer: --!
        return this.comment(code);
    }
  }

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
        case GT:
          return 'data';
        default:
          this.emitCharacter(CLOSE_SQUARE_BRACKET);
          return this.cdataSection(code);
      }
    }
  }
}