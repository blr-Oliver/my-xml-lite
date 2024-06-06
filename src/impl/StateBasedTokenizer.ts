import {
  isAsciiAlpha,
  isAsciiAlphaNum,
  isAsciiUpperAlpha,
  isControl,
  isDigit,
  isHexDigit,
  isLowerHexDigit,
  isNonCharacter,
  isSpace,
  isSurrogate,
  isUpperHexDigit
} from '../common/code-checks';
import {CodePoints} from '../common/code-points';
import {stringToArray} from '../common/code-sequences';
import {PrefixNode} from '../decl/entity-ref-index';
import {ParserEnvironment} from '../decl/ParserEnvironment';
import {BaseComposer, NS_HTML} from './composer/BaseComposer';
import {State} from './states';
import {Attribute, CDataToken, CharactersToken, CommentToken, DoctypeToken, EOF_TOKEN, TagToken, Token} from './tokens';

const SCRIPT: number[] = [0x73, 0x63, 0x72, 0x69, 0x70, 0x74];
const TWO_HYPHENS: number[] = [CodePoints.HYPHEN, CodePoints.HYPHEN];
const CDATA: number[] = [0x5B, 0x43, 0x44, 0x41, 0x54, 0x41, 0x5B];
const DOCTYPE: number[] = [0x64, 0x6F, 0x63, 0x74, 0x79, 0x70, 0x65];
const PUBLIC: number[] = [0x70, 0x75, 0x62, 0x6C, 0x69, 0x63];
const SYSTEM: number[] = [0x73, 0x79, 0x73, 0x74, 0x65, 0x6D];

const CHAR_REF_REPLACEMENT: number[] = [
  0x20AC, 0x0000, 0x201A, 0x0192, 0x201E, 0x2026, 0x2020, 0x2021,
  0x02C6, 0x2030, 0x0160, 0x2039, 0x0152, 0x0000, 0x017D, 0x0000,
  0x0000, 0x2018, 0x2019, 0x201C, 0x201D, 0x2022, 0x2013, 0x2014,
  0x02DC, 0x2122, 0x0161, 0x203A, 0x0153, 0x0000, 0x017E, 0x0178
];

interface IStateBasedTokenizer {
  readonly env: ParserEnvironment;
  readonly state: State;
  readonly active: boolean;
  lastOpenTag?: string;
  composer?: BaseComposer;
  proceed(): void;
}

export type WhitespaceMode = 'ignoreLeading' | 'emitLeading' | 'mixed' | 'whitespaceOnly';

export class StateBasedTokenizer implements IStateBasedTokenizer {
  env!: ParserEnvironment;
  state: State = 'data';
  active: boolean = true;
  lastOpenTag?: string;
  tokenQueue: Token[] = [];

  returnState!: State;
  inAttribute!: boolean;

  currentComment!: CommentToken;
  currentTag!: TagToken;
  currentAttribute!: Attribute;
  currentAttributeNames!: { [name: string]: true };
  currentDoctype!: DoctypeToken;

  sequenceBufferOffset!: number;
  sequenceData!: readonly number[];
  sequenceIndex!: number;
  sequenceCI!: boolean;
  sequencePositiveState!: State;
  sequenceNegativeState!: State;

  textEndMark!: number;

  referenceStartMark!: number;
  charCode!: number;
  refsIndex!: PrefixNode<number[]>;

  whitespaceMode: WhitespaceMode = 'mixed';
  hasWhitespaceOnly: boolean = true;

  composer!: BaseComposer;

  constructor(refsIndex: PrefixNode<number[]>) {
    this.refsIndex = refsIndex;
  }

  proceed() {
    let code: number = 0;
    while (this.active) {
      code = this.nextCode();
      if (code === CodePoints.EOC) break;
      this.state = this.execState(this.state, code);
      this.commitTokens();
    }
  }

  nextCode(): number {
    // TODO inline repeated calls
    return this.env.input.next();
  }

  execState(state: State, code: number): State {
    // @ts-ignore
    return this[state](code);
  }

  // TODO inline this for static transitions
  callState(state: State, code: number): State {
    return this.execState(this.state = state, code);
  }

  commitTokens() {
    // TODO this looks strange
    const sink = this.env.tokens;
    if (sink) {
      for (let i = 0; i < this.tokenQueue.length; ++i)
        sink.accept(this.tokenQueue[i]);
    }
    this.tokenQueue.length = 0;
  }

  error(name: string) {
    this.env.errors.push(name);
  }

  emit(token: Token) {
    this.tokenQueue.push(token);
  }

  emitCurrentTag() {
    this.emit(this.currentTag);
    // @ts-ignore
    this.currentTag = undefined;
    // @ts-ignore
    this.currentAttribute = undefined;
    // @ts-ignore
    this.currentAttributeNames = undefined;
  }

  emitAccumulatedCharacters() {
    const buffer = this.env.buffer;
    if (buffer.position) {
      this.emit({
        type: 'characters',
        data: buffer.takeString(),
        whitespaceOnly: this.hasWhitespaceOnly
      } as CharactersToken);
      this.hasWhitespaceOnly = true;
    }
  }

  emitCData() {
    this.emit({
      type: 'cdata',
      data: this.env.buffer.takeString(),
      whitespaceOnly: this.hasWhitespaceOnly
    } as CDataToken);
    this.hasWhitespaceOnly = true;
  }

  emitCurrentComment() {
    this.currentComment.data = this.env.buffer.takeString();
    this.emit(this.currentComment);
    // @ts-ignore
    this.currentComment = undefined;
  }

  emitCurrentDoctype() {
    this.emit(this.currentDoctype);
    // @ts-ignore
    this.currentDoctype = undefined;
  }

  eofInDoctype(): State {
    this.currentDoctype.forceQuirks = true;
    this.error('eof-in-doctype');
    this.emitCurrentDoctype();
    return this.eof();
  }

  eof(): State {
    this.emit(EOF_TOKEN);
    this.active = false;
    return 'eof';
  }

  startNewTag(name: string = '') {
    this.currentTag = {
      name,
      type: 'startTag',
      selfClosing: false,
      attributes: []
    };
    this.currentAttributeNames = {};
  }

  startNewAttribute() {
    this.currentTag.attributes.push(this.currentAttribute = {
      name: '',
      value: null
    });
  }

  startNewComment() {
    this.currentComment = {
      type: 'comment',
      data: ''
    };
  }

  startNewDoctype(forceQuirks: boolean = false) {
    this.currentDoctype = {
      type: 'doctype',
      name: undefined,
      publicId: undefined,
      systemId: undefined,
      forceQuirks
    };
  }

  appendCharacter(code: number) {
    if (isSpace(code)) this.appendWhitespace(code);
    else this.appendNonWhitespace(code);
  }
  appendWhitespace(code: number) {
    if (this.whitespaceMode !== 'ignoreLeading' || !this.hasWhitespaceOnly)
      this.env.buffer.append(code);
  }
  appendNonWhitespace(code: number) {
    switch (this.whitespaceMode) {
      case 'ignoreLeading':
        this.hasWhitespaceOnly = false;
        break;
      case 'emitLeading':
        if (this.hasWhitespaceOnly) {
          this.emitAccumulatedCharacters();
          this.hasWhitespaceOnly = false;
        }
        break;
      case 'mixed':
        this.hasWhitespaceOnly = false;
        break;
      case 'whitespaceOnly':
        this.error('unexpected-non-whitespace-character');
        return;
    }
    this.env.buffer.append(code);
  }

  /**
   Initiates "sequence matching" mode. In this mode input is checked against provided sequence, verbatim or case-insensitive.
   Sequence mode either completes "positively" when input completely matches the expected sequence or exits "negatively" when first difference occurs.
   In both outcomes all processed characters are appended to the accumulating buffer verbatim (even in case-insensitive mode).
   During this mode the parser state is "sequence" and several fields track information about the process.

   @param code current input character
   @param seq the sequence to check input against
   @param caseInsensitive match ASCII upper alpha characters from input as they were lower alpha
   @param positiveState state to continue when the sequence is confirmed; first character in that state will be the character immediately AFTER the sequence
   @param negativeState state to continue when the sequence is failed; first character in that state will be the first character that differs
   */
  matchSequence(code: number, seq: readonly number[], caseInsensitive: boolean, positiveState: State, negativeState: State): State {
    this.state = 'sequence';
    this.sequenceBufferOffset = this.env.buffer.position;
    this.sequenceData = seq;
    this.sequenceIndex = 0;
    this.sequencePositiveState = positiveState;
    this.sequenceNegativeState = negativeState;
    return (this.sequenceCI = caseInsensitive) ? this.sequenceCaseInsensitive(code) : this.sequenceCaseSensitive(code);
  }

  sequence(code: number): State {
    return this.sequenceCI ? this.sequenceCaseInsensitive(code) : this.sequenceCaseSensitive(code);
  }

  sequenceCaseSensitive(code: number): State {
    const seqData = this.sequenceData;
    const buffer = this.env.buffer;
    const len = this.sequenceData.length;
    while (this.sequenceIndex < len) {
      if (code === CodePoints.EOC) return 'sequence';
      if (code !== seqData[this.sequenceIndex++])
        return this.callState(this.sequenceNegativeState, code);
      buffer.append(code); // TODO check if this should belong to characters
      code = this.nextCode();
    }
    return this.callState(this.sequencePositiveState, code);
  }

  sequenceCaseInsensitive(code: number): State {
    const seqData = this.sequenceData;
    const buffer = this.env.buffer;
    const len = this.sequenceData.length;
    while (this.sequenceIndex < len) {
      if (code === CodePoints.EOC) return 'sequence';
      let ciCode = code;
      if (isAsciiUpperAlpha(ciCode)) ciCode += 0x20;
      if (ciCode !== seqData[this.sequenceIndex++])
        return this.callState(this.sequenceNegativeState, code);
      buffer.append(code); // TODO check if this should belong to characters
      code = this.nextCode();
    }
    return this.callState(this.sequencePositiveState, code);
  }

  // -----text helpers-----
  textDataNoRefs(code: number, ltState: State): State {
    while (true) {
      switch (code) {
        case CodePoints.LT:
          return ltState;
        case CodePoints.EOF:
          this.emitAccumulatedCharacters();
          return this.eof();
        case CodePoints.NUL:
          this.error('unexpected-null-character');
          code = CodePoints.REPLACEMENT_CHAR;
        default:
          this.appendCharacter(code);
          code = this.nextCode();
          break;
      }
    }
  }

  textDataWithRefs(code: number, ltState: State): State {
    while (true) {
      switch (code) {
        case CodePoints.AMPERSAND:
          this.returnState = this.state;
          this.inAttribute = false;
          return 'characterReference';
        case CodePoints.LT:
          return ltState;
        case CodePoints.EOF:
          this.emitAccumulatedCharacters();
          return this.eof();
        case CodePoints.NUL:
          this.error('unexpected-null-character');
          code = CodePoints.REPLACEMENT_CHAR;
        default:
          this.appendCharacter(code);
          code = this.nextCode();
          break;
      }
    }
  }

  textDataLessThanSign(code: number, endTagOpenState: State, textState: State): State {
    while (true) {
      switch (code) {
        case CodePoints.SLASH:
          return endTagOpenState;
        case CodePoints.LT:
          this.appendNonWhitespace(code);
          code = this.nextCode();
          break;
        default:
          this.appendNonWhitespace(CodePoints.LT);
          return this.callState(textState, code);
      }
    }
  }

  textDataEndTagOpen(code: number, tagNameState: State, textState: State): State {
    const buffer = this.env.buffer;
    if (isAsciiAlpha(code)) {
      this.textEndMark = buffer.position;
      buffer.append(CodePoints.LT); // TODO check if this should belong to characters
      buffer.append(CodePoints.SLASH);
      return this.callState(tagNameState, code);
    } else {
      buffer.append(CodePoints.LT); // TODO check if this should belong to characters
      buffer.append(CodePoints.SLASH);
      return this.callState(textState, code);
    }
  }

  textDataEndTagMatched(code: number, textState: State): State {
    switch (code) {
      case CodePoints.TAB:
      case CodePoints.LF:
      case CodePoints.FF:
      case CodePoints.SPACE:
        this.createTextDataEndTag(this.lastOpenTag!);
        return 'beforeAttributeName';
      case CodePoints.SLASH:
        this.createTextDataEndTag(this.lastOpenTag!);
        return 'selfClosingStartTag';
      case CodePoints.GT:
        this.createTextDataEndTag(this.lastOpenTag!);
        this.emitCurrentTag();
        return 'data';
      default:
        return this.callState(textState, code);
    }
  }

  createTextDataEndTag(tag: string): void {
    const buffer = this.env.buffer;
    buffer.position = this.textEndMark;
    this.emitAccumulatedCharacters();
    this.startNewTag(tag);
    this.currentTag.type = 'endTag';
    this.lastOpenTag = undefined;
  }

  data(code: number): State {
    while (true) {
      switch (code) {
        case CodePoints.AMPERSAND:
          this.returnState = this.state;
          this.inAttribute = false;
          return 'characterReference';
        case CodePoints.LT:
          return 'tagOpen';
        case CodePoints.EOF:
          this.emitAccumulatedCharacters();
          return this.eof();
        case CodePoints.NUL:
          this.error('unexpected-null-character');
          if (!this.composer.shouldUseForeignRules()) break;
          else code = CodePoints.REPLACEMENT_CHAR;
        default:
          this.appendCharacter(code);
          code = this.nextCode();
          break;
      }
    }
  }

  plaintext(code: number): State {
    while (true) {
      switch (code) {
        case CodePoints.EOF:
          this.emitAccumulatedCharacters();
          return this.eof();
        case CodePoints.NUL:
          this.error('unexpected-null-character');
          code = CodePoints.REPLACEMENT_CHAR;
        default:
          this.appendCharacter(code);
          code = this.nextCode();
          break;
      }
    }
  }

  // -----tag states-----
  tagOpen(code: number): State {
    const buffer = this.env.buffer;
    switch (code) {
      case CodePoints.EXCLAMATION:
        return 'markupDeclarationOpen';
      case CodePoints.SLASH:
        this.startNewTag();
        return 'endTagOpen';
      case CodePoints.QUESTION:
        this.emitAccumulatedCharacters();
        this.error('unexpected-question-mark-instead-of-tag-name');
        this.startNewComment();
        return this.callState('bogusComment', code);
      case CodePoints.EOF:
        buffer.append(CodePoints.LT);
        this.emitAccumulatedCharacters();
        this.error('eof-before-tag-name');
        return this.eof();
      default:
        if (isAsciiAlpha(code)) {
          this.emitAccumulatedCharacters();
          this.startNewTag();
          return this.callState('tagName', code);
        }
        this.error('invalid-first-character-of-tag-name');
        buffer.append(CodePoints.LT);
        return this.callState('data', code);
    }
  }

  endTagOpen(code: number): State {
    switch (code) {
      case CodePoints.GT:
        this.error('missing-end-tag-name');
        return 'data';
      case CodePoints.EOF:
        this.appendNonWhitespace(CodePoints.LT);
        this.appendNonWhitespace(CodePoints.SLASH);
        this.emitAccumulatedCharacters();
        this.error('eof-before-tag-name');
        return this.eof();
      default:
        if (isAsciiAlpha(code)) {
          this.emitAccumulatedCharacters();
          this.currentTag.type = 'endTag';
          return this.callState('tagName', code);
        }
        this.emitAccumulatedCharacters();
        this.error('invalid-first-character-of-tag-name');
        this.startNewComment();
        return this.callState('bogusComment', code);
    }
  }

  tagName(code: number): State {
    const buffer = this.env.buffer;
    while (true) {
      switch (code) {
        case CodePoints.TAB:
        case CodePoints.LF:
        case CodePoints.FF:
        case CodePoints.SPACE:
          this.currentTag.name = buffer.takeString();
          return 'beforeAttributeName';
        case CodePoints.SLASH:
          this.currentTag.name = buffer.takeString();
          return 'selfClosingStartTag';
        case CodePoints.GT:
          this.currentTag.name = buffer.takeString();
          this.emitCurrentTag();
          return 'data';
        case CodePoints.EOF:
          this.error('eof-in-tag');
          return this.eof();
        case CodePoints.NUL:
          this.error('unexpected-null-character');
          code = CodePoints.REPLACEMENT_CHAR;
        default:
          if (isAsciiUpperAlpha(code)) code += 0x20; // toLowerCase
          buffer.append(code);
          code = this.nextCode();
      }
    }
  }

  beforeAttributeName(code: number): State {
    while (true) {
      switch (code) {
        case CodePoints.TAB:
        case CodePoints.LF:
        case CodePoints.FF:
        case CodePoints.SPACE:
          code = this.nextCode();
          break;
        case CodePoints.SLASH:
        case CodePoints.GT:
        case CodePoints.EOF:
          return this.callState('afterAttributeName', code);
        case CodePoints.EQ:
          this.error('unexpected-equals-sign-before-attribute-name');
          this.startNewAttribute();
          this.env.buffer.append(code);
          return 'attributeName';
        default:
          this.startNewAttribute();
          return this.callState('attributeName', code);
      }
    }
  }

  attributeName(code: number): State {
    const buffer = this.env.buffer;
    while (true) {
      switch (code) {
        case CodePoints.EQ:
          this.checkDuplicateAttribute(this.currentAttribute.name = buffer.takeString());
          return 'beforeAttributeValue';
        case CodePoints.TAB:
        case CodePoints.LF:
        case CodePoints.FF:
        case CodePoints.SPACE:
        case CodePoints.GT:
        case CodePoints.SLASH:
        case CodePoints.EOF:
          this.checkDuplicateAttribute(this.currentAttribute.name = buffer.takeString());
          return this.callState('afterAttributeName', code);
        case CodePoints.NUL:
          this.error('unexpected-null-character');
          buffer.append(CodePoints.REPLACEMENT_CHAR);
          break;
        case CodePoints.SINGLE_QUOTE:
        case CodePoints.DOUBLE_QUOTE:
        case CodePoints.LT:
          this.error('unexpected-character-in-attribute-name');
        default:
          if (isAsciiUpperAlpha(code)) code += 0x20; // toLowerCase
          buffer.append(code);
      }
      code = this.nextCode();
    }
  }

  checkDuplicateAttribute(name: string) {
    if (name in this.currentAttributeNames) {
      this.error('duplicate-attribute');
      this.currentTag.attributes.pop();
    } else
      this.currentAttributeNames[name] = true;
  }

  afterAttributeName(code: number): State {
    while (true) {
      switch (code) {
        case CodePoints.EQ:
          return 'beforeAttributeValue';
        case CodePoints.TAB:
        case CodePoints.LF:
        case CodePoints.FF:
        case CodePoints.SPACE:
          code = this.nextCode();
          break;
        case CodePoints.GT:
          this.emitCurrentTag();
          return 'data';
        case CodePoints.SLASH:
          return 'selfClosingStartTag';
        case CodePoints.EOF:
          this.error('eof-in-tag');
          return this.eof();
        default:
          this.startNewAttribute();
          return this.callState('attributeName', code);
      }
    }
  }

  beforeAttributeValue(code: number): State {
    while (true) {
      switch (code) {
        case CodePoints.TAB:
        case CodePoints.LF:
        case CodePoints.FF:
        case CodePoints.SPACE:
          code = this.nextCode();
          break;
        case CodePoints.DOUBLE_QUOTE:
          return 'attributeValueDoubleQuoted';
        case CodePoints.SINGLE_QUOTE:
          return 'attributeValueSingleQuoted';
        case CodePoints.GT:
          this.error('missing-attribute-value');
          this.emitCurrentTag();
          return 'data';
        default:
          return this.callState('attributeValueUnquoted', code);
      }
    }
  }


  attributeValueDoubleQuoted(code: number): State {
    return this.attributeValueQuoted(code, CodePoints.DOUBLE_QUOTE);
  }

  attributeValueSingleQuoted(code: number): State {
    return this.attributeValueQuoted(code, CodePoints.SINGLE_QUOTE);
  }

  attributeValueQuoted(code: number, terminator: number): State {
    const buffer = this.env.buffer;
    while (true) {
      switch (code) {
        case terminator:
          this.currentAttribute.value = buffer.takeString();
          return 'afterAttributeValueQuoted';
        case CodePoints.AMPERSAND:
          this.returnState = this.state;
          this.inAttribute = true;
          return 'characterReference';
        case CodePoints.EOF:
          this.error('eof-in-tag');
          return this.eof();
        case CodePoints.NUL:
          this.error('unexpected-null-character');
          code = CodePoints.REPLACEMENT_CHAR;
        default:
          buffer.append(code);
          code = this.nextCode();
          break;
      }
    }
  }

  attributeValueUnquoted(code: number): State {
    const buffer = this.env.buffer;
    while (true) {
      switch (code) {
        case CodePoints.TAB:
        case CodePoints.LF:
        case CodePoints.FF:
        case CodePoints.SPACE:
          this.currentAttribute.value = buffer.takeString();
          return 'beforeAttributeName';
        case CodePoints.AMPERSAND:
          this.returnState = this.state;
          this.inAttribute = true;
          return 'characterReference';
        case CodePoints.GT:
          this.currentAttribute.value = buffer.takeString();
          this.emitCurrentTag();
          return 'data';
        case CodePoints.NUL:
          this.error('unexpected-null-character');
          buffer.append(CodePoints.REPLACEMENT_CHAR);
          code = this.nextCode();
          break;
        case CodePoints.EOF:
          this.error('eof-in-tag');
          return this.eof();
        case CodePoints.DOUBLE_QUOTE:
        case CodePoints.SINGLE_QUOTE:
        case CodePoints.LT:
        case CodePoints.EQ:
        case 0x60: // grave accent (`)
          this.error('unexpected-character-in-unquoted-attribute-value');
        default:
          buffer.append(code);
          code = this.nextCode();
      }
    }
  }

  afterAttributeValueQuoted(code: number): State {
    switch (code) {
      case CodePoints.TAB:
      case CodePoints.LF:
      case CodePoints.FF:
      case CodePoints.SPACE:
        return 'beforeAttributeName';
      case CodePoints.SLASH:
        return 'selfClosingStartTag';
      case CodePoints.GT:
        this.emitCurrentTag();
        return 'data';
      case CodePoints.EOF:
        this.error('eof-in-tag');
        return this.eof();
      default:
        this.error('missing-whitespace-between-attributes');
        return this.callState('beforeAttributeName', code);
    }
  }

  selfClosingStartTag(code: number): State {
    switch (code) {
      case CodePoints.GT:
        this.currentTag.selfClosing = true;
        this.emitCurrentTag();
        return 'data';
      case CodePoints.EOF:
        this.error('eof-in-tag');
        return this.eof();
      default:
        this.error('unexpected-solidus-in-tag');
        return this.callState('beforeAttributeName', code);
    }
  }

  // -----CDATA states-----
  cdataSectionStart(code: number): State {
    this.env.buffer.position = this.sequenceBufferOffset;
    return this.callState('cdataSection', code);
  }

  cdataSection(code: number): State {
    while (true) {
      switch (code) {
        case CodePoints.CLOSE_SQUARE_BRACKET:
          return 'cdataSectionBracket';
        case CodePoints.EOF:
          this.emitCData();
          this.error('eof-in-cdata');
          return this.eof();
        case CodePoints.NUL:
          this.error('unexpected-null-character');
          code = CodePoints.REPLACEMENT_CHAR;
        default:
          this.appendCharacter(code);
          code = this.nextCode();
      }
    }
  }

  cdataSectionBracket(code: number): State {
    if (code === CodePoints.CLOSE_SQUARE_BRACKET)
      return 'cdataSectionEnd';
    else {
      this.appendNonWhitespace(CodePoints.CLOSE_SQUARE_BRACKET);
      return this.callState('cdataSection', code);
    }
  }

  cdataSectionEnd(code: number): State {
    while (true) {
      switch (code) {
        case CodePoints.CLOSE_SQUARE_BRACKET:
          this.appendNonWhitespace(CodePoints.CLOSE_SQUARE_BRACKET);
          code = this.nextCode();
          break;
        case CodePoints.GT:
          this.emitCData();
          return 'data';
        default:
          this.appendNonWhitespace(CodePoints.CLOSE_SQUARE_BRACKET);
          this.appendNonWhitespace(CodePoints.CLOSE_SQUARE_BRACKET);
          return this.callState('cdataSection', code);
      }
    }
  }

  // -----character reference states-----
  characterReference(code: number): State {
    const buffer = this.env.buffer;
    this.referenceStartMark = buffer.position;
    if (this.inAttribute) buffer.append(CodePoints.AMPERSAND);
    else this.appendNonWhitespace(CodePoints.AMPERSAND);
    if (code === CodePoints.SHARP) {
      if (this.inAttribute) buffer.append(CodePoints.SHARP);
      else this.appendNonWhitespace(CodePoints.SHARP);
      return 'numericCharacterReference';
    } else if (isAsciiAlphaNum(code))
      return this.callState('namedCharacterReference', code);
    else
      return this.callState(this.returnState, code);
  }

  numericCharacterReference(code: number): State {
    this.charCode = 0;
    if (code === CodePoints.X_CAPITAL || code === CodePoints.X_REGULAR) {
      if (this.inAttribute) this.env.buffer.append(code);
      else this.appendNonWhitespace(code);
      return 'hexadecimalCharacterReferenceStart';
    } else
      return this.callState('decimalCharacterReferenceStart', code);
  }

  numericCharacterReferenceEnd(): void {
    const buffer = this.env.buffer;
    let charCode = this.charCode;
    if (charCode === 0) {
      this.error('null-character-reference');
      charCode = CodePoints.REPLACEMENT_CHAR;
    } else if (charCode > 0x10FFFF) {
      this.error('character-reference-outside-unicode-range');
      charCode = CodePoints.REPLACEMENT_CHAR;
    } else if (isSurrogate(charCode)) {
      this.error('surrogate-character-reference');
      charCode = CodePoints.REPLACEMENT_CHAR;
    } else if (isNonCharacter(charCode)) {
      this.error('noncharacter-character-reference');
    } else if (charCode === 0x0D || (!isSpace(charCode) && isControl(charCode))) {
      this.error('control-character-reference');
      charCode = CHAR_REF_REPLACEMENT[charCode - 0x80] || charCode;
    }
    buffer.position = this.referenceStartMark;
    if (this.inAttribute) buffer.append(charCode);
    else this.appendCharacter(charCode);
  }

  namedCharacterReference(code: number): State {
    const buffer = this.env.buffer;
    let node = this.refsIndex, next: PrefixNode<number[]>;
    let lastMatch = 0x00;
    while (node.children && (next = node.children[code])) {
      node = next;
      if (this.inAttribute) buffer.append(lastMatch = code);
      else this.appendNonWhitespace(lastMatch = code);
      code = this.nextCode();
    }
    if (node.value) {
      if (this.inAttribute && lastMatch !== CodePoints.SEMICOLON && (code === CodePoints.EQ || isAsciiAlphaNum(code))) { // for historical reasons
        return this.callState(this.returnState, code);
      } else {
        if (lastMatch !== CodePoints.SEMICOLON)
          this.error('missing-semicolon-after-character-reference');
        buffer.position = this.referenceStartMark;
        buffer.appendSequence(node.value);
        return this.callState(this.returnState, code);
      }
    } else
      return this.callState('ambiguousAmpersand', code);
  }

  hexadecimalCharacterReferenceStart(code: number): State {
    if (!isHexDigit(code)) {
      this.error('absence-of-digits-in-numeric-character-reference');
      return this.callState(this.returnState, code);
    } else
      return this.callState('hexadecimalCharacterReference', code);
  }

  hexadecimalCharacterReference(code: number): State {
    while (true) {
      if (code === CodePoints.SEMICOLON) {
        this.numericCharacterReferenceEnd();
        return this.returnState;
      } else if (isDigit(code)) {
        this.charCode = this.charCode * 16 + code - 0x30;
      } else if (isUpperHexDigit(code)) {
        this.charCode = this.charCode * 16 + code - 0x37;
      } else if (isLowerHexDigit(code)) {
        this.charCode = this.charCode * 16 + code - 0x57;
      } else {
        this.error('missing-semicolon-after-character-reference');
        this.numericCharacterReferenceEnd();
        return this.callState(this.returnState, code);
      }
      code = this.nextCode();
    }
  }

  decimalCharacterReferenceStart(code: number): State {
    if (!isDigit(code)) {
      this.error('absence-of-digits-in-numeric-character-reference');
      return this.callState(this.returnState, code);
    } else
      return this.callState('decimalCharacterReference', code);
  }

  decimalCharacterReference(code: number): State {
    while (true) {
      if (code === CodePoints.SEMICOLON) {
        this.numericCharacterReferenceEnd();
        return this.returnState;
      } else if (isDigit(code)) {
        this.charCode = this.charCode * 10 + code - 0x30;
      } else {
        this.error('missing-semicolon-after-character-reference');
        this.numericCharacterReferenceEnd();
        return this.callState(this.returnState, code);
      }
      code = this.nextCode();
    }
  }

  ambiguousAmpersand(code: number): State {
    const buffer = this.env.buffer;
    while (true) {
      if (code === CodePoints.SEMICOLON) {
        this.error('unknown-named-character-reference');
        return this.callState(this.returnState, code);
      } else if (isAsciiAlphaNum(code)) {
        if (this.inAttribute)
          buffer.append(code);
        else
          this.appendNonWhitespace(code);
        code = this.nextCode();
      } else
        return this.callState(this.returnState, code);
    }
  }

  // -----comment states-----
  commentStart(code: number): State {
    this.env.buffer.position = this.sequenceBufferOffset;
    this.startNewComment();
    switch (code) {
      case CodePoints.HYPHEN:
        return 'commentStartDash';
      case CodePoints.GT:
        this.error('abrupt-closing-of-empty-comment');
        this.emitCurrentComment();
        return 'data';
      default:
        return this.callState('comment', code);
    }
  }

  commentStartDash(code: number): State {
    switch (code) {
      case CodePoints.HYPHEN:
        return 'commentEnd';
      case CodePoints.GT:
        this.error('abrupt-closing-of-empty-comment');
        this.emitCurrentComment();
        return 'data';
      case CodePoints.EOF:
        this.error('eof-in-comment');
        this.emitCurrentComment();
        return this.eof();
      default:
        this.env.buffer.append(CodePoints.HYPHEN);
        return this.callState('comment', code);
    }
  }

  comment(code: number): State {
    const buffer = this.env.buffer;
    while (true) {
      switch (code) {
        case CodePoints.LT:
          buffer.append(code);
          return 'commentLessThanSign';
        case CodePoints.HYPHEN:
          return 'commentEndDash';
        case CodePoints.EOF:
          this.error('eof-in-comment');
          this.emitCurrentComment();
          return this.eof();
        case CodePoints.NUL:
          this.error('unexpected-null-character');
          code = CodePoints.REPLACEMENT_CHAR;
        default:
          buffer.append(code);
          code = this.nextCode();
      }
    }
  }

  commentLessThanSign(code: number): State {
    const buffer = this.env.buffer;
    while (true) {
      switch (code) {
        case CodePoints.EXCLAMATION:
          buffer.append(code);
          return 'commentLessThanSignBang';
        case CodePoints.LT:
          buffer.append(code);
          code = this.nextCode();
          break;
        default:
          return this.callState('comment', code);
      }
    }
  }

  commentLessThanSignBang(code: number): State {
    if (code === CodePoints.HYPHEN)
      return 'commentLessThanSignBangDash';
    else
      return this.callState('comment', code);
  }

  commentLessThanSignBangDash(code: number): State {
    if (code === CodePoints.HYPHEN)
      return 'commentLessThanSignBangDashDash';
    else
      return this.callState('commentEndDash', code);
  }

  commentLessThanSignBangDashDash(code: number): State {
    if (code !== CodePoints.GT && code !== CodePoints.EOF)
      this.error('nested-comment');
    return this.callState('commentEnd', code);
  }

  commentEndDash(code: number): State {
    switch (code) {
      case CodePoints.HYPHEN:
        return 'commentEnd';
      case CodePoints.EOF:
        // by the spec extra dash is NOT appended here
        // so unfinished comments ending with single dash do NOT include that dash in data
        this.error('eof-in-comment');
        this.emitCurrentComment();
        return this.eof();
      default:
        this.env.buffer.append(CodePoints.HYPHEN);
        return this.callState('comment', code);
    }
  }

  commentEnd(code: number): State {
    const buffer = this.env.buffer;
    while (true) {
      switch (code) {
        case CodePoints.GT:
          this.emitCurrentComment();
          return 'data';
        case CodePoints.EXCLAMATION:
          return 'commentEndBang';
        case CodePoints.EOF:
          this.error('eof-in-comment');
          this.emitCurrentComment();
          return this.eof();
        case CodePoints.HYPHEN:
          buffer.append(code);
          code = this.nextCode();
          break;
        default:
          buffer.append(CodePoints.HYPHEN);
          buffer.append(CodePoints.HYPHEN);
          return this.callState('comment', code);
      }
    }
  }

  commentEndBang(code: number): State {
    const buffer = this.env.buffer;
    const data = buffer.buffer;
    let position: number;
    switch (code) {
      case CodePoints.HYPHEN:
        // TODO this might be good variant overload candidate
        position = buffer.position;
        data[position++] = CodePoints.HYPHEN;
        data[position++] = CodePoints.HYPHEN;
        data[position++] = CodePoints.EXCLAMATION;
        buffer.position += 3;
        return 'commentEndDash';
      case CodePoints.GT:
        this.error('incorrectly-closed-comment');
        this.emitCurrentComment();
        return 'data';
      case CodePoints.EOF:
        this.error('eof-in-comment');
        this.emitCurrentComment();
        return this.eof();
      default:
        position = buffer.position;
        data[position++] = CodePoints.HYPHEN;
        data[position++] = CodePoints.HYPHEN;
        data[position++] = CodePoints.EXCLAMATION;
        buffer.position += 3;
        return this.callState('comment', code);
    }
  }

  bogusComment(code: number): State {
    const buffer = this.env.buffer;
    while (true) {
      switch (code) {
        case CodePoints.GT:
          this.emitCurrentComment();
          return 'data';
        case CodePoints.EOF:
          this.emitCurrentComment();
          return this.eof();
        case CodePoints.NUL:
          this.error('unexpected-null-character');
          code = CodePoints.REPLACEMENT_CHAR;
        default:
          buffer.append(code);
          code = this.nextCode();
      }
    }
  }

  markupDeclarationOpen(code: number): State {
    this.emitAccumulatedCharacters();
    switch (code) {
      case CodePoints.HYPHEN:
        return this.matchSequence(code, TWO_HYPHENS, false, 'commentStart', 'markupDeclarationFail');
      case 0x44: // D
      case 0x64: // d
        return this.matchSequence(code, DOCTYPE, true, 'doctype', 'markupDeclarationFail');
      case CodePoints.OPEN_SQUARE_BRACKET:
        if (this.composer && this.composer.adjustedCurrentNode && this.composer.adjustedCurrentNode.namespaceURI !== NS_HTML)
          return this.matchSequence(code, CDATA, false, 'cdataSectionStart', 'markupDeclarationFail');
      default:
        return this.callState('markupDeclarationFail', code);
    }
  }

  markupDeclarationFail(code: number): State {
    this.startNewComment();
    this.error('incorrectly-opened-comment');
    return this.callState('bogusComment', code);
  }

  // -----doctype states-----
  doctype(code: number): State {
    this.env.buffer.position = this.sequenceBufferOffset;
    this.emitAccumulatedCharacters();
    this.startNewDoctype();
    switch (code) {
      case CodePoints.TAB:
      case CodePoints.LF:
      case CodePoints.FF:
      case CodePoints.SPACE:
        return 'beforeDoctypeName';
      case CodePoints.EOF:
        return this.eofInDoctype();
      default:
        this.error('missing-whitespace-before-doctype-name');
      case CodePoints.GT:
        return this.callState('beforeDoctypeName', code);
    }
  }

  beforeDoctypeName(code: number): State {
    const buffer = this.env.buffer;
    while (true) {
      switch (code) {
        case CodePoints.TAB:
        case CodePoints.LF:
        case CodePoints.FF:
        case CodePoints.SPACE:
          code = this.nextCode();
          break;
        case CodePoints.GT:
          this.error('missing-doctype-name');
          this.currentDoctype.forceQuirks = true;
          this.emitCurrentDoctype();
          return 'data';
        case CodePoints.EOF:
          return this.eofInDoctype();
        case CodePoints.NUL:
          this.error('unexpected-null-character');
          code = CodePoints.REPLACEMENT_CHAR;
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
        case CodePoints.TAB:
        case CodePoints.LF:
        case CodePoints.FF:
        case CodePoints.SPACE:
          this.currentDoctype.name = buffer.takeString();
          return 'afterDoctypeName';
        case CodePoints.GT:
          this.currentDoctype.name = buffer.takeString();
          this.emitCurrentDoctype();
          return 'data';
        case CodePoints.EOF:
          this.currentDoctype.name = buffer.takeString();
          return this.eofInDoctype();
        case CodePoints.NUL:
          this.error('unexpected-null-character');
          code = CodePoints.REPLACEMENT_CHAR;
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
        case CodePoints.TAB:
        case CodePoints.LF:
        case CodePoints.FF:
        case CodePoints.SPACE:
          code = this.nextCode();
          break;
        case CodePoints.GT:
          this.emitCurrentDoctype();
          return 'data';
        case CodePoints.EOF:
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
      case CodePoints.TAB:
      case CodePoints.LF:
      case CodePoints.FF:
      case CodePoints.SPACE:
        return 'beforeDoctypePublicIdentifier';
      case CodePoints.DOUBLE_QUOTE:
        this.error('missing-whitespace-after-doctype-public-keyword');
        return 'doctypePublicIdentifierDoubleQuoted';
      case CodePoints.SINGLE_QUOTE:
        this.error('missing-whitespace-after-doctype-public-keyword');
        return 'doctypePublicIdentifierSingleQuoted';
      case CodePoints.GT:
        this.currentDoctype.forceQuirks = true;
        this.error('missing-doctype-public-identifier');
        this.emitCurrentDoctype();
        return 'data';
      case CodePoints.EOF:
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
        case CodePoints.TAB:
        case CodePoints.LF:
        case CodePoints.FF:
        case CodePoints.SPACE:
          code = this.nextCode();
          break;
        case CodePoints.DOUBLE_QUOTE:
          return 'doctypePublicIdentifierDoubleQuoted';
        case CodePoints.SINGLE_QUOTE:
          return 'doctypePublicIdentifierSingleQuoted';
        case CodePoints.GT:
          this.currentDoctype.forceQuirks = true;
          this.error('missing-doctype-public-identifier');
          this.emitCurrentDoctype();
          return 'data';
        case CodePoints.EOF:
          return this.eofInDoctype();
        default:
          this.currentDoctype.forceQuirks = true;
          this.error('missing-quote-before-doctype-public-identifier');
          return this.callState('bogusDoctype', code);
      }
    }
  }

  doctypePublicIdentifierDoubleQuoted(code: number): State {
    return this.doctypePublicIdentifierQuoted(code, CodePoints.DOUBLE_QUOTE);
  }

  doctypePublicIdentifierSingleQuoted(code: number): State {
    return this.doctypePublicIdentifierQuoted(code, CodePoints.SINGLE_QUOTE);
  }

  doctypePublicIdentifierQuoted(code: number, terminator: number): State {
    const buffer = this.env.buffer;
    while (true) {
      switch (code) {
        case terminator:
          this.currentDoctype.publicId = buffer.takeString();
          return 'afterDoctypePublicIdentifier';
        case CodePoints.GT:
          this.currentDoctype.publicId = buffer.takeString();
          this.currentDoctype.forceQuirks = true;
          this.error('abrupt-doctype-public-identifier');
          this.emitCurrentDoctype();
          return 'data';
        case CodePoints.EOF:
          this.currentDoctype.publicId = buffer.takeString();
          return this.eofInDoctype();
        case CodePoints.NUL:
          this.error('unexpected-null-character');
          code = CodePoints.REPLACEMENT_CHAR;
        default:
          buffer.append(code);
          code = this.nextCode();
      }
    }
  }

  afterDoctypePublicIdentifier(code: number): State {
    switch (code) {
      case CodePoints.TAB:
      case CodePoints.LF:
      case CodePoints.FF:
      case CodePoints.SPACE:
        return 'betweenDoctypePublicAndSystemIdentifiers';
      case CodePoints.GT:
        this.emitCurrentDoctype();
        return 'data';
      case CodePoints.DOUBLE_QUOTE:
        this.error('missing-whitespace-between-doctype-public-and-system-identifiers');
        return 'doctypeSystemIdentifierDoubleQuoted';
      case CodePoints.SINGLE_QUOTE:
        this.error('missing-whitespace-between-doctype-public-and-system-identifiers');
        return 'doctypeSystemIdentifierSingleQuoted';
      case CodePoints.EOF:
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
        case CodePoints.TAB:
        case CodePoints.LF:
        case CodePoints.FF:
        case CodePoints.SPACE:
          code = this.nextCode();
          break;
        case CodePoints.DOUBLE_QUOTE:
          return 'doctypeSystemIdentifierDoubleQuoted';
        case CodePoints.SINGLE_QUOTE:
          return 'doctypeSystemIdentifierSingleQuoted';
        case CodePoints.GT:
          this.emitCurrentDoctype();
          return 'data';
        case CodePoints.EOF:
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
      case CodePoints.TAB:
      case CodePoints.LF:
      case CodePoints.FF:
      case CodePoints.SPACE:
        return 'beforeDoctypeSystemIdentifier';
      case CodePoints.DOUBLE_QUOTE:
        this.error('missing-whitespace-after-doctype-system-keyword');
        return 'doctypeSystemIdentifierDoubleQuoted';
      case CodePoints.SINGLE_QUOTE:
        this.error('missing-whitespace-after-doctype-system-keyword');
        return 'doctypeSystemIdentifierSingleQuoted';
      case CodePoints.GT:
        this.currentDoctype.forceQuirks = true;
        this.error('missing-doctype-system-identifier');
        this.emitCurrentDoctype();
        return 'data';
      case CodePoints.EOF:
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
        case CodePoints.TAB:
        case CodePoints.LF:
        case CodePoints.FF:
        case CodePoints.SPACE:
          code = this.nextCode();
          break;
        case CodePoints.DOUBLE_QUOTE:
          return 'doctypeSystemIdentifierDoubleQuoted';
        case CodePoints.SINGLE_QUOTE:
          return 'doctypeSystemIdentifierSingleQuoted';
        case CodePoints.GT:
          this.currentDoctype.forceQuirks = true;
          this.error('missing-doctype-system-identifier');
          this.emitCurrentDoctype();
          return 'data';
        case CodePoints.EOF:
          return this.eofInDoctype();
        default:
          this.currentDoctype.forceQuirks = true;
          this.error('missing-quote-before-doctype-system-identifier');
          return this.callState('bogusDoctype', code);
      }
    }
  }

  doctypeSystemIdentifierDoubleQuoted(code: number): State {
    return this.doctypeSystemIdentifierQuoted(code, CodePoints.DOUBLE_QUOTE);
  }
  doctypeSystemIdentifierSingleQuoted(code: number): State {
    return this.doctypeSystemIdentifierQuoted(code, CodePoints.SINGLE_QUOTE);
  }

  doctypeSystemIdentifierQuoted(code: number, terminator: number): State {
    const buffer = this.env.buffer;
    while (true) {
      switch (code) {
        case terminator:
          this.currentDoctype.systemId = buffer.takeString();
          return 'afterDoctypeSystemIdentifier';
        case CodePoints.GT:
          this.currentDoctype.systemId = buffer.takeString();
          this.currentDoctype.forceQuirks = true;
          this.error('abrupt-doctype-system-identifier');
          this.emitCurrentDoctype();
          return 'data';
        case CodePoints.EOF:
          this.currentDoctype.systemId = buffer.takeString();
          return this.eofInDoctype();
        case CodePoints.NUL:
          this.error('unexpected-null-character');
          code = CodePoints.REPLACEMENT_CHAR;
        default:
          buffer.append(code);
          code = this.nextCode();
      }
    }
  }

  afterDoctypeSystemIdentifier(code: number): State {
    while (true) {
      switch (code) {
        case CodePoints.TAB:
        case CodePoints.LF:
        case CodePoints.FF:
        case CodePoints.SPACE:
          code = this.nextCode();
          break;
        case CodePoints.GT:
          this.emitCurrentDoctype();
          return 'data';
        case CodePoints.EOF:
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
        case CodePoints.GT:
          this.emitCurrentDoctype()
          return 'data';
        case CodePoints.EOF:
          this.emitCurrentDoctype();
          return this.eof();
        case CodePoints.NUL:
          this.error('unexpected-null-character');
        default:
          code = this.nextCode();
      }
    }
  }

  // -----script states-----
  scriptData(code: number): State {
    return this.textDataNoRefs(code, 'scriptDataLessThanSign');
  }

  scriptDataLessThanSign(code: number): State {
    switch (code) {
      case CodePoints.SLASH:
        return 'scriptDataEndTagOpen';
      case CodePoints.EXCLAMATION:
        this.appendNonWhitespace(CodePoints.LT);
        this.appendNonWhitespace(CodePoints.EXCLAMATION);
        return 'scriptDataEscapeStart';
      default:
        this.appendNonWhitespace(CodePoints.LT);
        return this.callState('scriptData', code);
    }
  }

  scriptDataEndTagOpen(code: number): State {
    return this.textDataEndTagOpen(code, 'scriptDataEndTagName', 'scriptData');
  }

  scriptDataEndTagName(code: number): State {
    return this.matchSequence(code, SCRIPT, true, 'scriptDataEndTagNameMatched', 'scriptData');
  }

  scriptDataEndTagNameMatched(code: number): State {
    return this.textDataEndTagMatched(code, 'scriptData');
  }

  scriptDataEscapeStart(code: number): State {
    if (code === CodePoints.HYPHEN) {
      this.appendNonWhitespace(code);
      return 'scriptDataEscapeStartDash';
    } else
      return this.callState('scriptData', code);
  }

  scriptDataEscapeStartDash(code: number): State {
    if (code === CodePoints.HYPHEN) {
      this.appendNonWhitespace(code);
      return 'scriptDataEscapedDashDash';
    } else
      return this.callState('scriptData', code);
  }

  scriptDataEscaped(code: number): State {
    while (true) {
      switch (code) {
        case CodePoints.HYPHEN:
          this.appendNonWhitespace(code);
          return 'scriptDataEscapedDash';
        case CodePoints.LT:
          return 'scriptDataEscapedLessThanSign';
        case CodePoints.EOF:
          this.error('eof-in-script-html-comment-like-text');
          this.emitAccumulatedCharacters();
          return this.eof();
        case CodePoints.NUL:
          this.error('unexpected-null-character');
          code = CodePoints.REPLACEMENT_CHAR;
        default:
          this.appendCharacter(code);
          code = this.nextCode();
      }
    }
  }

  scriptDataEscapedDash(code: number): State {
    switch (code) {
      case CodePoints.HYPHEN:
        this.appendNonWhitespace(code);
        return 'scriptDataEscapedDashDash';
      case CodePoints.LT:
        return 'scriptDataEscapedLessThanSign';
      case CodePoints.EOF:
        this.error('eof-in-script-html-comment-like-text');
        this.emitAccumulatedCharacters();
        return this.eof();
      case CodePoints.NUL:
        this.error('unexpected-null-character');
        code = CodePoints.REPLACEMENT_CHAR;
      default:
        this.appendCharacter(code);
        return 'scriptDataEscaped';
    }
  }

  scriptDataEscapedDashDash(code: number): State {
    while (true) {
      switch (code) {
        case CodePoints.HYPHEN:
          this.appendNonWhitespace(code);
          code = this.nextCode();
          break;
        case CodePoints.LT:
          return 'scriptDataEscapedLessThanSign';
        case CodePoints.GT:
          this.appendNonWhitespace(code);
          return 'scriptData';
        case CodePoints.EOF:
          this.error('eof-in-script-html-comment-like-text');
          this.emitAccumulatedCharacters();
          return this.eof();
        case CodePoints.NUL:
          this.error('unexpected-null-character');
          code = CodePoints.REPLACEMENT_CHAR;
        default:
          this.appendCharacter(code);
          return 'scriptDataEscaped';
      }
    }
  }

  scriptDataEscapedLessThanSign(code: number): State {
    if (code === CodePoints.SLASH) {
      return 'scriptDataEscapedEndTagOpen';
    } else if (isAsciiAlpha(code)) {
      this.appendNonWhitespace(CodePoints.LT);
      return this.scriptDataDoubleEscapeStart(code);
    } else {
      this.appendNonWhitespace(CodePoints.LT);
      return this.callState('scriptDataEscaped', code);
    }
  }

  scriptDataEscapedEndTagOpen(code: number): State {
    return this.textDataEndTagOpen(code, 'scriptDataEscapedEndTagName', 'scriptDataEscaped')
  }

  scriptDataEscapedEndTagName(code: number): State {
    return this.matchSequence(code, SCRIPT, true, 'scriptDataEndTagNameMatched', 'scriptDataEscaped');
  }

  scriptDataEscapedEndTagNameMatched(code: number): State {
    return this.textDataEndTagMatched(code, 'scriptDataEscaped');
  }

  scriptDataDoubleEscapeStart(code: number): State {
    return this.matchSequence(code, SCRIPT, true, 'scriptDataDoubleEscapeStartMatched', 'scriptDataEscaped');
  }

  scriptDataDoubleEscapeStartMatched(code: number): State {
    switch (code) {
      case CodePoints.TAB:
      case CodePoints.LF:
      case CodePoints.FF:
      case CodePoints.SPACE:
        this.appendWhitespace(code);
        return 'scriptDataDoubleEscaped';
      case CodePoints.SLASH:
      case CodePoints.GT:
        this.appendNonWhitespace(code);
        return 'scriptDataDoubleEscaped';
      default:
        return this.callState('scriptDataEscaped', code);
    }
  }

  scriptDataDoubleEscaped(code: number): State {
    while (true) {
      switch (code) {
        case CodePoints.HYPHEN:
          this.appendNonWhitespace(code);
          return 'scriptDataDoubleEscapedDash';
        case CodePoints.LT:
          this.appendNonWhitespace(code);
          return 'scriptDataDoubleEscapedLessThanSign';
        case CodePoints.EOF:
          this.error('eof-in-script-html-comment-like-text');
          this.emitAccumulatedCharacters();
          return this.eof();
        case CodePoints.NUL:
          this.error('unexpected-null-character');
          code = CodePoints.REPLACEMENT_CHAR;
        default:
          this.appendCharacter(code);
          code = this.nextCode();
          break;
      }
    }
  }

  scriptDataDoubleEscapedDash(code: number): State {
    switch (code) {
      case CodePoints.HYPHEN:
        this.appendNonWhitespace(code);
        return 'scriptDataDoubleEscapedDashDash';
      case CodePoints.LT:
        this.appendNonWhitespace(code);
        return 'scriptDataDoubleEscapedLessThanSign';
      case CodePoints.NUL:
        this.error('unexpected-null-character');
        this.appendNonWhitespace(CodePoints.REPLACEMENT_CHAR);
        return 'scriptDataDoubleEscaped';
      case CodePoints.EOF:
        this.error('eof-in-script-html-comment-like-text');
        this.emitAccumulatedCharacters();
        return this.eof();
      default:
        this.appendCharacter(code);
        return 'scriptDataDoubleEscaped';
    }
  }

  scriptDataDoubleEscapedDashDash(code: number): State {
    while (true) {
      switch (code) {
        case CodePoints.HYPHEN:
          this.appendNonWhitespace(code);
          code = this.nextCode();
          break;
        case CodePoints.LT:
          this.appendNonWhitespace(code);
          return 'scriptDataDoubleEscapedLessThanSign';
        case CodePoints.GT:
          this.appendNonWhitespace(code);
          return 'scriptData';
        case CodePoints.NUL:
          this.error('unexpected-null-character');
          this.appendNonWhitespace(CodePoints.REPLACEMENT_CHAR);
          return 'scriptDataDoubleEscaped';
        case CodePoints.EOF:
          this.error('eof-in-script-html-comment-like-text');
          this.emitAccumulatedCharacters();
          return this.eof();
        default:
          this.appendCharacter(code);
          return 'scriptDataDoubleEscaped';
      }
    }
  }

  scriptDataDoubleEscapedLessThanSign(code: number): State {
    if (code === CodePoints.SLASH) {
      this.appendNonWhitespace(code);
      return 'scriptDataDoubleEscapeEnd';
    } else {
      return this.callState('scriptDataDoubleEscaped', code);
    }
  }

  scriptDataDoubleEscapeEnd(code: number) {
    return this.matchSequence(code, SCRIPT, true, 'scriptDataDoubleEscapeEndMatched', 'scriptDataDoubleEscaped');
  }

  scriptDataDoubleEscapeEndMatched(code: number): State {
    switch (code) {
      case CodePoints.TAB:
      case CodePoints.LF:
      case CodePoints.FF:
      case CodePoints.SPACE:
        this.appendWhitespace(code);
        return 'scriptDataEscaped';
      case CodePoints.SLASH:
      case CodePoints.GT:
        this.appendNonWhitespace(code);
        return 'scriptDataEscaped';
      default:
        return this.callState('scriptDataDoubleEscaped', code);
    }
  }
  // -----text states-----
  rawtext(code: number): State {
    return this.textDataNoRefs(code, 'rawtextLessThanSign');
  }

  rawtextLessThanSign(code: number): State {
    return this.textDataLessThanSign(code, 'rawtextEndTagOpen', 'rawtext');
  }

  rawtextEndTagOpen(code: number): State {
    return this.textDataEndTagOpen(code, 'rawtextEndTagName', 'rawtext');
  }

  rawtextEndTagName(code: number): State {
    return this.matchSequence(code, stringToArray(this.lastOpenTag!), true, 'rawtextEndTagNameMatched', 'rawtext');
  }

  rawtextEndTagNameMatched(code: number): State {
    return this.textDataEndTagMatched(code, 'rawtext');
  }

  rcdata(code: number): State {
    return this.textDataWithRefs(code, 'rcdataLessThanSign');
  }

  rcdataLessThanSign(code: number): State {
    return this.textDataLessThanSign(code, 'rcdataEndTagOpen', 'rcdata');
  }

  rcdataEndTagOpen(code: number): State {
    return this.textDataEndTagOpen(code, 'rcdataEndTagName', 'rcdata');
  }

  rcdataEndTagName(code: number): State {
    return this.matchSequence(code, stringToArray(this.lastOpenTag!), true, 'rcdataEndTagNameMatched', 'rcdata');
  }

  rcdataEndTagNameMatched(code: number): State {
    return this.textDataEndTagMatched(code, 'rcdata');
  }
}