import {
  AMPERSAND,
  CDATA,
  CLOSE_SQUARE_BRACKET,
  DOCTYPE,
  DOUBLE_QUOTE,
  EOC,
  EOF,
  EQ,
  EXCLAMATION,
  FF,
  GT,
  HYPHEN,
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
  isUpperHexDigit,
  LF,
  LT,
  NUL,
  OPEN_SQUARE_BRACKET,
  QUESTION,
  REPLACEMENT_CHAR,
  SEMICOLON,
  SHARP,
  SINGLE_QUOTE,
  SOLIDUS,
  SPACE,
  stringToArray,
  TAB,
  TWO_HYPHENS,
  X_CAPITAL,
  X_REGULAR
} from '../common/code-points';
import {ParserEnvironment} from '../decl/ParserEnvironment';
import {CHAR_REF_REPLACEMENT, PrefixNode} from './character-reference/entity-ref-index';
import {State} from './states';
import {Attribute, CommentToken, DoctypeToken, EOF_TOKEN, TagToken, TextToken, Token} from './tokens';

const SCRIPT: number[] = [0x73, 0x63, 0x72, 0x69, 0x70, 0x74] as const;
const PUBLIC: number[] = [0x70, 0x75, 0x62, 0x6C, 0x69, 0x63] as const;
const SYSTEM: number[] = [0x73, 0x79, 0x73, 0x74, 0x65, 0x6D] as const;

export class CompositeTokenizer {
  env!: ParserEnvironment;
  state: State = 'data';
  active: boolean = true;
  tokenQueue: Token[] = [];

  returnState!: State;
  inAttribute!: boolean;

  currentComment!: CommentToken;
  currentTag!: TagToken;
  currentAttribute!: Attribute;
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

  constructor(refsIndex: PrefixNode<number[]>) {
    this.refsIndex = refsIndex;
  }

  proceed() {
    let code: number = 0;
    while (this.active) {
      code = this.nextCode();
      if (code === EOC) break;
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
  }

  emitAccumulatedCharacters() {
    const buffer = this.env.buffer;
    if (buffer.position) {
      this.emit({
        type: 'characters',
        data: buffer.takeString()
      } as TextToken);
    }
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
    }
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
      if (code === EOC) return 'sequence';
      if (code !== seqData[this.sequenceIndex++])
        return this.callState(this.sequenceNegativeState, code);
      buffer.append(code);
      code = this.nextCode();
    }
    return this.callState(this.sequencePositiveState, code);
  }

  sequenceCaseInsensitive(code: number): State {
    const seqData = this.sequenceData;
    const buffer = this.env.buffer;
    const len = this.sequenceData.length;
    while (this.sequenceIndex < len) {
      if (code === EOC) return 'sequence';
      let ciCode = code;
      if (isAsciiUpperAlpha(ciCode)) ciCode += 0x20;
      if (ciCode !== seqData[this.sequenceIndex++])
        return this.callState(this.sequenceNegativeState, code);
      buffer.append(code);
      code = this.nextCode();
    }
    return this.callState(this.sequencePositiveState, code);
  }

  // -----text helpers-----
  textDataNoRefs(code: number, ltState: State): State {
    const buffer = this.env.buffer;
    while (true) {
      switch (code) {
        case LT:
          return ltState;
        case EOF:
          this.emitAccumulatedCharacters();
          return this.eof();
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

  textDataWithRefs(code: number, ltState: State): State {
    const buffer = this.env.buffer;
    while (true) {
      switch (code) {
        case AMPERSAND:
          this.returnState = this.state;
          this.inAttribute = false;
          return 'characterReference';
        case LT:
          return ltState;
        case EOF:
          this.emitAccumulatedCharacters();
          return this.eof();
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

  textDataLessThanSign(code: number, endTagOpenState: State, textState: State): State {
    const buffer = this.env.buffer;
    while (true) {
      switch (code) {
        case SOLIDUS:
          return endTagOpenState;
        case LT:
          buffer.append(code);
          code = this.nextCode();
          break;
        default:
          buffer.append(LT);
          return this.callState(textState, code);
      }
    }
  }

  textDataEndTagOpen(code: number, tagNameState: State, textState: State): State {
    const buffer = this.env.buffer;
    if (isAsciiAlpha(code)) {
      this.textEndMark = buffer.position;
      buffer.append(LT);
      buffer.append(SOLIDUS);
      return this.callState(tagNameState, code);
    } else {
      buffer.append(LT);
      buffer.append(SOLIDUS);
      return this.callState(textState, code);
    }
  }

  textDataEndTagMatched(code: number, tag: string, textState: State): State {
    switch (code) {
      case TAB:
      case LF:
      case FF:
      case SPACE:
        this.createTextDataEndTag(tag);
        return 'beforeAttributeName';
      case SOLIDUS:
        this.createTextDataEndTag(tag);
        return 'selfClosingStartTag';
      case GT:
        this.createTextDataEndTag(tag);
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
  }

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
          return this.eof();
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
          return this.eof();
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

  // -----tag states-----
  tagOpen(code: number): State {
    const buffer = this.env.buffer;
    switch (code) {
      case EXCLAMATION:
        return 'markupDeclarationOpen';
      case SOLIDUS:
        this.startNewTag();
        return 'endTagOpen';
      case QUESTION:
        this.emitAccumulatedCharacters();
        this.error('unexpected-question-mark-instead-of-tag-name');
        this.startNewComment();
        return this.callState('bogusComment', code);
      case EOF:
        buffer.append(LT);
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
        buffer.append(LT);
        return this.callState('data', code);
    }
  }

  endTagOpen(code: number): State {
    switch (code) {
      case GT:
        this.error('missing-end-tag-name');
        return 'data';
      case EOF:
        const buffer = this.env.buffer;
        buffer.append(LT);
        buffer.append(SOLIDUS);
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
        case TAB:
        case LF:
        case FF:
        case SPACE:
          this.currentTag.name = buffer.takeString();
          return 'beforeAttributeName';
        case SOLIDUS:
          this.currentTag.name = buffer.takeString();
          return 'selfClosingStartTag';
        case GT:
          this.currentTag.name = buffer.takeString();
          this.emitCurrentTag();
          return 'data';
        case EOF:
          this.error('eof-in-tag');
          return this.eof();
        case NUL:
          this.error('unexpected-null-character');
          code = REPLACEMENT_CHAR;
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
        case TAB:
        case LF:
        case FF:
        case SPACE:
          code = this.nextCode();
          break;
        case SOLIDUS:
        case GT:
        case EOF:
          return this.callState('afterAttributeName', code);
        case EQ:
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
        case EQ:
          this.currentAttribute.name = buffer.takeString();
          return 'beforeAttributeValue';
        case TAB:
        case LF:
        case FF:
        case SPACE:
        case GT:
        case SOLIDUS:
        case EOF:
          this.currentAttribute.name = buffer.takeString();
          return this.callState('afterAttributeName', code);
        case NUL:
          this.error('unexpected-null-character');
          buffer.append(REPLACEMENT_CHAR);
          break;
        case SINGLE_QUOTE:
        case DOUBLE_QUOTE:
        case LT:
          this.error('unexpected-character-in-attribute-name');
        default:
          if (isAsciiUpperAlpha(code)) code += 0x20; // toLowerCase
          buffer.append(code);
      }
      code = this.nextCode();
    }
  }

  afterAttributeName(code: number): State {
    while (true) {
      switch (code) {
        case EQ:
          return 'beforeAttributeValue';
        case TAB:
        case LF:
        case FF:
        case SPACE:
          code = this.nextCode();
          break;
        case GT:
          this.emitCurrentTag();
          return 'data';
        case SOLIDUS:
          return 'selfClosingStartTag';
        case EOF:
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
        case TAB:
        case LF:
        case FF:
        case SPACE:
          code = this.nextCode();
          break;
        case DOUBLE_QUOTE:
          return 'attributeValueDoubleQuoted';
        case SINGLE_QUOTE:
          return 'attributeValueSingleQuoted';
        case GT:
          this.error('missing-attribute-value');
          this.emitCurrentTag();
          return 'data';
        default:
          return this.callState('attributeValueUnquoted', code);
      }
    }
  }


  attributeValueDoubleQuoted(code: number): State {
    return this.attributeValueQuoted(code, DOUBLE_QUOTE);
  }

  attributeValueSingleQuoted(code: number): State {
    return this.attributeValueQuoted(code, SINGLE_QUOTE);
  }

  attributeValueQuoted(code: number, terminator: number): State {
    const buffer = this.env.buffer;
    while (true) {
      switch (code) {
        case terminator:
          this.currentAttribute.value = buffer.takeString();
          return 'afterAttributeValueQuoted';
        case AMPERSAND:
          this.returnState = this.state;
          this.inAttribute = true;
          return 'characterReference';
        case EOF:
          this.error('eof-in-tag');
          return this.eof();
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

  attributeValueUnquoted(code: number): State {
    const buffer = this.env.buffer;
    while (true) {
      switch (code) {
        case TAB:
        case LF:
        case FF:
        case SPACE:
          this.currentAttribute.value = buffer.takeString();
          return 'beforeAttributeName';
        case AMPERSAND:
          this.returnState = this.state;
          this.inAttribute = true;
          return 'characterReference';
        case GT:
          this.currentAttribute.value = buffer.takeString();
          this.emitCurrentTag();
          return 'data';
        case NUL:
          this.error('unexpected-null-character');
          buffer.append(REPLACEMENT_CHAR);
          code = this.nextCode();
          break;
        case EOF:
          this.error('eof-in-tag');
          return this.eof();
        case DOUBLE_QUOTE:
        case SINGLE_QUOTE:
        case LT:
        case EQ:
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
      case TAB:
      case LF:
      case FF:
      case SPACE:
        return 'beforeAttributeName';
      case SOLIDUS:
        return 'selfClosingStartTag';
      case GT:
        this.emitCurrentTag();
        return 'data';
      case EOF:
        this.error('eof-in-tag');
        return this.eof();
      default:
        this.error('missing-whitespace-between-attributes');
        return this.callState('beforeAttributeName', code);
    }
  }

  selfClosingStartTag(code: number): State {
    switch (code) {
      case GT:
        this.currentTag.selfClosing = true;
        this.emitCurrentTag();
        return 'data';
      case EOF:
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

  // -----character reference states-----
  characterReference(code: number): State {
    const buffer = this.env.buffer;
    this.referenceStartMark = buffer.position;
    buffer.append(AMPERSAND);
    if (code === SHARP) {
      buffer.append(code);
      return 'numericCharacterReference';
    } else if (isAsciiAlphaNum(code))
      return this.callState('namedCharacterReference', code);
    else
      return this.callState(this.returnState, code);
  }

  numericCharacterReference(code: number): State {
    this.charCode = 0;
    if (code === X_CAPITAL || code === X_REGULAR) {
      this.env.buffer.append(code);
      return 'hexadecimalCharacterReferenceStart';
    } else
      return this.callState('decimalCharacterReferenceStart', code);
  }

  numericCharacterReferenceEnd(): void {
    const buffer = this.env.buffer;
    let charCode = this.charCode;
    if (charCode === 0) {
      this.error('null-character-reference');
      charCode = REPLACEMENT_CHAR;
    } else if (charCode > 0x10FFFF) {
      this.error('character-reference-outside-unicode-range');
      charCode = REPLACEMENT_CHAR;
    } else if (isSurrogate(charCode)) {
      this.error('surrogate-character-reference');
      charCode = REPLACEMENT_CHAR;
    } else if (isNonCharacter(charCode)) {
      this.error('noncharacter-character-reference');
    } else if (charCode === 0x0D || (!isSpace(charCode) && isControl(charCode))) {
      this.error('control-character-reference');
      charCode = CHAR_REF_REPLACEMENT[charCode - 0x80] || charCode;
    }
    buffer.position = this.referenceStartMark;
    buffer.append(charCode);
  }

  namedCharacterReference(code: number): State {
    const buffer = this.env.buffer;
    let node = this.refsIndex, next: PrefixNode<number[]>;
    let lastMatch = 0x00;
    while (node.children && (next = node.children[code])) {
      node = next;
      buffer.append(lastMatch = code);
      code = this.nextCode();
    }
    if (node.value) {
      if (this.inAttribute && lastMatch !== SEMICOLON && (code === EQ || isAsciiAlphaNum(code))) { // for historical reasons
        return this.callState(this.returnState, code);
      } else {
        if (lastMatch !== SEMICOLON)
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
      if (code === SEMICOLON) {
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
      if (code === SEMICOLON) {
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
      if (code === SEMICOLON) {
        this.error('unknown-named-character-reference');
        return this.callState(this.returnState, code);
      } else if (isAsciiAlphaNum(code)) {
        buffer.append(code);
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
      case HYPHEN:
        return 'commentStartDash';
      case GT:
        this.error('abrupt-closing-of-empty-comment');
        this.emitCurrentComment();
        return 'data';
      default:
        return this.callState('comment', code);
    }
  }

  commentStartDash(code: number): State {
    switch (code) {
      case HYPHEN:
        return 'commentEnd';
      case GT:
        this.error('abrupt-closing-of-empty-comment');
        this.emitCurrentComment();
        return 'data';
      case EOF:
        this.error('eof-in-comment');
        this.emitCurrentComment();
        return this.eof();
      default:
        this.env.buffer.append(HYPHEN);
        return this.callState('comment', code);
    }
  }

  comment(code: number): State {
    const buffer = this.env.buffer;
    while (true) {
      switch (code) {
        case LT:
          buffer.append(code);
          return 'commentLessThanSign';
        case HYPHEN:
          return 'commentEndDash';
        case EOF:
          this.error('eof-in-comment');
          this.emitCurrentComment();
          return this.eof();
        case NUL:
          this.error('unexpected-null-character');
          code = REPLACEMENT_CHAR;
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
        case EXCLAMATION:
          buffer.append(code);
          return 'commentLessThanSignBang';
        case LT:
          buffer.append(code);
          code = this.nextCode();
          break;
        default:
          return this.callState('comment', code);
      }
    }
  }

  commentLessThanSignBang(code: number): State {
    if (code === HYPHEN)
      return 'commentLessThanSignBangDash';
    else
      return this.callState('comment', code);
  }

  commentLessThanSignBangDash(code: number): State {
    if (code === HYPHEN)
      return 'commentLessThanSignBangDashDash';
    else
      return this.callState('commentEndDash', code);
  }

  commentLessThanSignBangDashDash(code: number): State {
    if (code !== GT && code !== EOF)
      this.error('nested-comment');
    return this.callState('commentEnd', code);
  }

  commentEndDash(code: number): State {
    switch (code) {
      case HYPHEN:
        return 'commentEnd';
      case EOF:
        // by the spec extra dash is NOT appended here
        // so unfinished comments ending with single dash do NOT include that dash in data
        this.error('eof-in-comment');
        this.emitCurrentComment();
        return this.eof();
      default:
        this.env.buffer.append(HYPHEN);
        return this.callState('comment', code);
    }
  }

  commentEnd(code: number): State {
    const buffer = this.env.buffer;
    while (true) {
      switch (code) {
        case GT:
          this.emitCurrentComment();
          return 'data';
        case EXCLAMATION:
          return 'commentEndBang';
        case EOF:
          this.error('eof-in-comment');
          this.emitCurrentComment();
          return this.eof();
        case HYPHEN:
          buffer.append(code);
          code = this.nextCode();
          break;
        default:
          buffer.append(HYPHEN);
          buffer.append(HYPHEN);
          return this.callState('comment', code);
      }
    }
  }

  commentEndBang(code: number): State {
    const buffer = this.env.buffer;
    const data = buffer.buffer;
    let position: number;
    switch (code) {
      case HYPHEN:
        // TODO this might be good variant overload candidate
        position = buffer.position;
        data[position++] = HYPHEN;
        data[position++] = HYPHEN;
        data[position++] = EXCLAMATION;
        buffer.position += 3;
        return 'commentEndDash';
      case GT:
        this.error('incorrectly-closed-comment');
        this.emitCurrentComment();
        return 'data';
      case EOF:
        this.error('eof-in-comment');
        this.emitCurrentComment();
        return this.eof();
      default:
        position = buffer.position;
        data[position++] = HYPHEN;
        data[position++] = HYPHEN;
        data[position++] = EXCLAMATION;
        buffer.position += 3;
        return this.callState('comment', code);
    }
  }

  bogusComment(code: number): State {
    const buffer = this.env.buffer;
    while (true) {
      switch (code) {
        case GT:
          this.emitCurrentComment();
          return 'data';
        case EOF:
          this.emitCurrentComment();
          return this.eof();
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
    // TODO deal with reconsuming the buffer when sequence fails
    switch (code) {
      case HYPHEN:
        return this.matchSequence(code, TWO_HYPHENS, false, 'commentStart', 'bogusComment');
      case 0x44: // D
      case 0x64: // d
        return this.matchSequence(code, DOCTYPE, true, 'doctype', 'bogusComment');
      case OPEN_SQUARE_BRACKET:
        this.emitAccumulatedCharacters();
        return this.matchSequence(code, CDATA, false, 'cdataSectionStart', 'bogusComment');
      default:
        this.emitAccumulatedCharacters();
        this.error('incorrectly-opened-comment');
        return this.callState('bogusComment', code);
    }
  }

  // -----doctype states-----
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

  doctypePublicIdentifierQuoted(code: number, terminator: number): State {
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

  doctypeSystemIdentifierQuoted(code: number, terminator: number): State {
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

  // -----script states-----
  scriptData(code: number): State {
    return this.textDataNoRefs(code, 'scriptDataLessThanSign');
  }

  scriptDataLessThanSign(code: number): State {
    const buffer = this.env.buffer;
    switch (code) {
      case SOLIDUS:
        return 'scriptDataEndTagOpen';
      case EXCLAMATION:
        buffer.append(LT);
        buffer.append(EXCLAMATION);
        return 'scriptDataEscapeStart';
      default:
        buffer.append(LT);
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
    return this.textDataEndTagMatched(code, 'script', 'scriptData');
  }

  scriptDataEscapeStart(code: number): State {
    if (code === HYPHEN) {
      this.env.buffer.append(code);
      return 'scriptDataEscapeStartDash';
    } else
      return this.callState('scriptData', code);
  }

  scriptDataEscapeStartDash(code: number): State {
    if (code === HYPHEN) {
      this.env.buffer.append(code);
      return 'scriptDataEscapedDashDash';
    } else
      return this.callState('scriptData', code);
  }

  scriptDataEscaped(code: number): State {
    const buffer = this.env.buffer;
    while (true) {
      switch (code) {
        case HYPHEN:
          buffer.append(code);
          return 'scriptDataEscapedDash';
        case LT:
          return 'scriptDataEscapedLessThanSign';
        case EOF:
          this.error('eof-in-script-html-comment-like-text');
          this.emitAccumulatedCharacters();
          return this.eof();
        case NUL:
          this.error('unexpected-null-character');
          code = REPLACEMENT_CHAR;
        default:
          buffer.append(code);
          code = this.nextCode();
      }
    }
  }

  scriptDataEscapedDash(code: number): State {
    const buffer = this.env.buffer;
    switch (code) {
      case HYPHEN:
        buffer.append(code);
        return 'scriptDataEscapedDashDash';
      case LT:
        return 'scriptDataEscapedLessThanSign';
      case EOF:
        this.error('eof-in-script-html-comment-like-text');
        this.emitAccumulatedCharacters();
        return this.eof();
      case NUL:
        this.error('unexpected-null-character');
        code = REPLACEMENT_CHAR;
      default:
        buffer.append(code);
        return 'scriptDataEscaped';
    }
  }

  scriptDataEscapedDashDash(code: number): State {
    const buffer = this.env.buffer;
    while (true) {
      switch (code) {
        case HYPHEN:
          buffer.append(code);
          code = this.nextCode();
          break;
        case LT:
          return 'scriptDataEscapedLessThanSign';
        case GT:
          buffer.append(code);
          return 'scriptData';
        case EOF:
          this.error('eof-in-script-html-comment-like-text');
          this.emitAccumulatedCharacters();
          return this.eof();
        case NUL:
          this.error('unexpected-null-character');
          code = REPLACEMENT_CHAR;
        default:
          buffer.append(code);
          return 'scriptDataEscaped';
      }
    }
  }

  scriptDataEscapedLessThanSign(code: number): State {
    const buffer = this.env.buffer;
    if (code === SOLIDUS) {
      return 'scriptDataEscapedEndTagOpen';
    } else if (isAsciiAlpha(code)) {
      buffer.append(LT);
      return this.scriptDataDoubleEscapeStart(code);
    } else {
      buffer.append(LT);
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
    return this.textDataEndTagMatched(code, 'script', 'scriptDataEscaped');
  }

  scriptDataDoubleEscapeStart(code: number): State {
    return this.matchSequence(code, SCRIPT, true, 'scriptDataDoubleEscapeStartMatched', 'scriptDataEscaped');
  }

  scriptDataDoubleEscapeStartMatched(code: number): State {
    switch (code) {
      case TAB:
      case LF:
      case FF:
      case SPACE:
      case SOLIDUS:
      case GT:
        this.env.buffer.append(code);
        return 'scriptDataDoubleEscaped';
      default:
        return this.callState('scriptDataEscaped', code);
    }
  }

  scriptDataDoubleEscaped(code: number): State {
    const buffer = this.env.buffer;
    while (true) {
      switch (code) {
        case HYPHEN:
          buffer.append(code);
          return 'scriptDataDoubleEscapedDash';
        case LT:
          buffer.append(code);
          return 'scriptDataDoubleEscapedLessThanSign';
        case EOF:
          this.error('eof-in-script-html-comment-like-text');
          this.emitAccumulatedCharacters();
          return this.eof();
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

  scriptDataDoubleEscapedDash(code: number): State {
    const buffer = this.env.buffer;
    switch (code) {
      case HYPHEN:
        buffer.append(code);
        return 'scriptDataDoubleEscapedDashDash';
      case LT:
        buffer.append(code);
        return 'scriptDataDoubleEscapedLessThanSign';
      case NUL:
        this.error('unexpected-null-character');
        buffer.append(REPLACEMENT_CHAR);
        return 'scriptDataDoubleEscaped';
      case EOF:
        this.error('eof-in-script-html-comment-like-text');
        this.emitAccumulatedCharacters();
        return this.eof();
      default:
        buffer.append(code);
        return 'scriptDataDoubleEscaped';
    }
  }

  scriptDataDoubleEscapedDashDash(code: number): State {
    const buffer = this.env.buffer;
    while (true) {
      switch (code) {
        case HYPHEN:
          buffer.append(code);
          code = this.nextCode();
          break;
        case LT:
          buffer.append(code);
          return 'scriptDataDoubleEscapedLessThanSign';
        case GT:
          buffer.append(code);
          return 'scriptData';
        case NUL:
          this.error('unexpected-null-character');
          buffer.append(REPLACEMENT_CHAR);
          return 'scriptDataDoubleEscaped';
        case EOF:
          this.error('eof-in-script-html-comment-like-text');
          this.emitAccumulatedCharacters();
          return this.eof();
        default:
          buffer.append(code);
          return 'scriptDataDoubleEscaped';
      }
    }
  }

  scriptDataDoubleEscapedLessThanSign(code: number): State {
    const buffer = this.env.buffer;
    if (code === SOLIDUS) {
      buffer.append(code);
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
      case TAB:
      case LF:
      case FF:
      case SPACE:
      case SOLIDUS:
      case GT:
        this.env.buffer.append(code);
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
    return this.matchSequence(code, stringToArray('noscript'), true, 'rawtextEndTagNameMatched', 'rawtext');
  }

  rawtextEndTagNameMatched(code: number): State {
    return this.textDataEndTagMatched(code, 'noscript', 'rawtext')
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
    return this.matchSequence(code, stringToArray('textarea'), true, 'rcdataEndTagNameMatched', 'rcdata');
  }

  rcdataEndTagNameMatched(code: number): State {
    return this.textDataEndTagMatched(code, 'textarea', 'rcdata');
  }
}