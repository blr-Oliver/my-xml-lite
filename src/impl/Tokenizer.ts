import {CharacterSource} from '../interfaces/CharacterSource.js';
import {CodePoints} from '../interfaces/CodePoints.js';
import {Element} from '../interfaces/dom-types.js';
import {ErrorHandler, ignoring} from '../interfaces/ErrorHandler.js';
import {PrefixNode} from '../interfaces/PrefixNode.js';
import {FixedSizeStringBuilder} from './FixedSizeStringBuilder.js';
import {StateEnum, StateStringReversedEnum} from './interfaces/states.js';
import {StringBuilder} from './interfaces/StringBuilder.js';
import {Attribute, CDataToken, CharactersToken, CommentToken, DoctypeToken, EOF_TOKEN, TagToken, Token} from './interfaces/tokens.js';
import {NS_HTML} from './TreeComposer.js';
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
} from './util/code-checks.js';
import {stringToArray} from './util/string-to-array.js';

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

export type WhitespaceMode = 'ignoreLeading' | 'emitLeading' | 'mixed' | 'whitespaceOnly';

export interface ComposerIntegration {
  readonly adjustedCurrentNode: Element | null;
  shouldUseForeignRules(): boolean;
  accept(token: Token): void;
}

export class Tokenizer {
  state!: StateEnum;
  active!: boolean;
  paused!: boolean;
  lastOpenTag?: string;
  tokenQueue: Token[];

  currentComment!: CommentToken;
  currentTag!: TagToken;
  currentAttribute!: Attribute;
  currentAttributeNames!: Set<string>;
  currentDoctype!: DoctypeToken;

  sequenceBufferOffset!: number;
  sequenceData!: readonly number[];
  sequenceIndex!: number;
  sequenceCI!: boolean;
  sequencePositiveState!: StateEnum;
  sequenceNegativeState!: StateEnum;

  textEndMark!: number;

  returnState!: StateEnum;
  inAttribute!: boolean;
  referenceStartMark!: number;
  charCode!: number;
  refsIndex: PrefixNode<number[]>;
  lastRefNode!: PrefixNode<number[]>;
  lastMatch!: number;

  whitespaceMode!: WhitespaceMode;
  hasWhitespaceOnly!: boolean;

  composer!: ComposerIntegration;

  input!: CharacterSource;
  buffer: StringBuilder;
  errorHandler: ErrorHandler;

  // TODO add input to constructor
  constructor(refsIndex: PrefixNode<number[]>, errorHandler: ErrorHandler = ignoring) {
    this.refsIndex = refsIndex;
    this.errorHandler = errorHandler;
    this.buffer = new FixedSizeStringBuilder(2048);
    this.tokenQueue = [];
    this.currentAttributeNames = new Set<string>();
    this.reset();
  }

  proceed() {
    let code: number = 0;
    this.paused = false;
    while (this.active && !this.paused) {
      code = this.nextCode();
      if (code === CodePoints.EOC) {
        this.paused = true;
        break;
      }
      this.state = this.execState(this.state, code);
      this.commitTokens();
    }
  }

  reset() {
    this.state = StateEnum.DATA;
    this.active = true;
    this.paused = false;
    this.lastOpenTag = undefined;
    this.tokenQueue.length = 0;
    this.currentAttributeNames.clear();
    this.sequenceBufferOffset = undefined as unknown as number;
    this.sequenceData = undefined as unknown as number[];
    this.sequenceIndex = undefined as unknown as number;
    this.sequenceCI = undefined as unknown as boolean;
    this.sequencePositiveState = undefined as unknown as StateEnum;
    this.sequenceNegativeState = undefined as unknown as StateEnum;
    this.textEndMark = undefined as unknown as number;
    this.returnState = undefined as unknown as StateEnum;
    this.inAttribute = undefined as unknown as boolean;
    this.referenceStartMark = undefined as unknown as number;
    this.charCode = undefined as unknown as number;
    this.lastRefNode = this.refsIndex;
    this.lastMatch = 0;
    this.whitespaceMode = 'ignoreLeading';
    this.hasWhitespaceOnly = true;
    this.buffer.clear();
  }

  nextCode(): number {
    // TODO inline repeated calls
    return this.input.next();
  }

  execState(state: StateEnum, code: number): StateEnum {
    // TODO switch through states
    // @ts-ignore
    return this[StateStringReversedEnum[state]](code);
  }

  // TODO inline this for static transitions
  callState(state: StateEnum, code: number): StateEnum {
    return this.execState(this.state = state, code);
  }

  commitTokens() {
    for (let i = 0; i < this.tokenQueue.length; ++i)
      this.composer.accept(this.tokenQueue[i]);
    this.tokenQueue.length = 0;
  }

  error(name: string) {
    this.errorHandler(name);
  }

  emit(token: Token) {
    this.tokenQueue.push(token);
  }

  emitCurrentTag() {
    this.emit(this.currentTag);
    this.currentTag = undefined as unknown as TagToken;
    this.currentAttribute = undefined as unknown as Attribute;
    this.currentAttributeNames.clear();
  }

  emitAccumulatedCharacters() {
    const buffer = this.buffer;
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
      data: this.buffer.takeString(),
      whitespaceOnly: this.hasWhitespaceOnly
    } as CDataToken);
    this.hasWhitespaceOnly = true;
  }

  emitCurrentComment() {
    this.currentComment.data = this.buffer.takeString();
    this.emit(this.currentComment);
    // @ts-ignore
    this.currentComment = undefined;
  }

  emitCurrentDoctype() {
    this.emit(this.currentDoctype);
    // @ts-ignore
    this.currentDoctype = undefined;
  }

  eofInDoctype(): StateEnum {
    this.currentDoctype.forceQuirks = true;
    this.error('eof-in-doctype');
    this.emitCurrentDoctype();
    return this.eof();
  }

  eof(): StateEnum {
    this.emit(EOF_TOKEN);
    this.active = false;
    return StateEnum.EOF;
  }

  startNewTag(name: string = '') {
    this.currentTag = {
      name,
      type: 'startTag',
      selfClosed: false,
      attributes: []
    };
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
      this.buffer.append(code);
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
    this.buffer.append(code);
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
  matchSequence(code: number, seq: readonly number[], caseInsensitive: boolean, positiveState: StateEnum, negativeState: StateEnum): StateEnum {
    this.state = StateEnum.SEQUENCE;
    this.sequenceBufferOffset = this.buffer.position;
    this.sequenceData = seq;
    this.sequenceIndex = 0;
    this.sequencePositiveState = positiveState;
    this.sequenceNegativeState = negativeState;
    return (this.sequenceCI = caseInsensitive) ? this.sequenceCaseInsensitive(code) : this.sequenceCaseSensitive(code);
  }

  sequence(code: number): StateEnum {
    return this.sequenceCI ? this.sequenceCaseInsensitive(code) : this.sequenceCaseSensitive(code);
  }

  sequenceCaseSensitive(code: number): StateEnum {
    const seqData = this.sequenceData;
    const buffer = this.buffer;
    const len = this.sequenceData.length;
    while (this.sequenceIndex < len) {
      if (code === CodePoints.EOC) return StateEnum.SEQUENCE;
      if (code !== seqData[this.sequenceIndex++])
        return this.callState(this.sequenceNegativeState, code);
      buffer.append(code); // TODO check if this should belong to characters
      code = this.nextCode();
    }
    if (code === CodePoints.EOC) {
      this.paused = true;
      return this.sequencePositiveState;
    }
    return this.callState(this.sequencePositiveState, code);
  }

  sequenceCaseInsensitive(code: number): StateEnum {
    const seqData = this.sequenceData;
    const buffer = this.buffer;
    const len = this.sequenceData.length;
    while (this.sequenceIndex < len) {
      if (code === CodePoints.EOC) return StateEnum.SEQUENCE;
      let ciCode = code;
      if (isAsciiUpperAlpha(ciCode)) ciCode += 0x20;
      if (ciCode !== seqData[this.sequenceIndex++])
        return this.callState(this.sequenceNegativeState, code);
      buffer.append(code); // TODO check if this should belong to characters
      code = this.nextCode();
    }
    if (code === CodePoints.EOC) {
      this.paused = true;
      return this.sequencePositiveState;
    }
    return this.callState(this.sequencePositiveState, code);
  }

  // -----text helpers-----
  textDataNoRefs(code: number, ltState: StateEnum, thisState: StateEnum): StateEnum {
    while (true) {
      switch (code) {
        case CodePoints.EOC:
          this.paused = true;
          return thisState;
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

  textDataLessThanSign(code: number, endTagOpenState: StateEnum, textState: StateEnum, thisState: StateEnum): StateEnum {
    while (true) {
      switch (code) {
        case CodePoints.EOC:
          this.paused = true;
          return thisState;
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

  textDataEndTagOpen(code: number, tagNameState: StateEnum, textState: StateEnum): StateEnum {
    const buffer = this.buffer;
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

  textDataEndTagMatched(code: number, textState: StateEnum): StateEnum {
    switch (code) {
      case CodePoints.TAB:
      case CodePoints.LF:
      case CodePoints.FF:
      case CodePoints.SPACE:
        this.createTextDataEndTag(this.lastOpenTag!);
        return StateEnum.BEFORE_ATTRIBUTE_NAME;
      case CodePoints.SLASH:
        this.createTextDataEndTag(this.lastOpenTag!);
        return StateEnum.SELF_CLOSING_START_TAG;
      case CodePoints.GT:
        this.createTextDataEndTag(this.lastOpenTag!);
        this.emitCurrentTag();
        return StateEnum.DATA;
      default:
        return this.callState(textState, code);
    }
  }

  createTextDataEndTag(tag: string): void {
    const buffer = this.buffer;
    buffer.position = this.textEndMark;
    this.emitAccumulatedCharacters();
    this.startNewTag(tag);
    this.currentTag.type = 'endTag';
    this.lastOpenTag = undefined;
  }

  data(code: number): StateEnum {
    while (true) {
      switch (code) {
        case CodePoints.EOC:
          this.paused = true;
          return StateEnum.DATA;
        case CodePoints.AMPERSAND:
          this.returnState = this.state;
          this.inAttribute = false;
          return StateEnum.CHARACTER_REFERENCE;
        case CodePoints.LT:
          return StateEnum.TAG_OPEN;
        case CodePoints.EOF:
          this.emitAccumulatedCharacters();
          return this.eof();
        case CodePoints.NUL:
          this.error('unexpected-null-character');
          if (!this.composer.shouldUseForeignRules()) {
            code = this.nextCode();
            break;
          } else
            code = CodePoints.REPLACEMENT_CHAR;
        default:
          this.appendCharacter(code);
          code = this.nextCode();
          break;
      }
    }
  }

  plaintext(code: number): StateEnum {
    while (true) {
      switch (code) {
        case CodePoints.EOC:
          this.paused = true;
          return StateEnum.PLAINTEXT;
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
  tagOpen(code: number): StateEnum {
    const buffer = this.buffer;
    switch (code) {
      case CodePoints.EXCLAMATION:
        return StateEnum.MARKUP_DECLARATION_OPEN;
      case CodePoints.SLASH:
        this.startNewTag();
        return StateEnum.END_TAG_OPEN;
      case CodePoints.QUESTION:
        this.emitAccumulatedCharacters();
        this.error('unexpected-question-mark-instead-of-tag-name');
        this.startNewComment();
        return this.callState(StateEnum.BOGUS_COMMENT, code);
      case CodePoints.EOF:
        this.appendCharacter(CodePoints.LT);
        this.emitAccumulatedCharacters();
        this.error('eof-before-tag-name');
        return this.eof();
      default:
        if (isAsciiAlpha(code)) {
          this.emitAccumulatedCharacters();
          this.startNewTag();
          return this.callState(StateEnum.TAG_NAME, code);
        }
        this.error('invalid-first-character-of-tag-name');
        buffer.append(CodePoints.LT);
        return this.callState(StateEnum.DATA, code);
    }
  }

  endTagOpen(code: number): StateEnum {
    switch (code) {
      case CodePoints.GT:
        this.error('missing-end-tag-name');
        return StateEnum.DATA;
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
          return this.callState(StateEnum.TAG_NAME, code);
        }
        this.emitAccumulatedCharacters();
        this.error('invalid-first-character-of-tag-name');
        this.startNewComment();
        return this.callState(StateEnum.BOGUS_COMMENT, code);
    }
  }

  tagName(code: number): StateEnum {
    const buffer = this.buffer;
    while (true) {
      switch (code) {
        case CodePoints.EOC:
          this.paused = true;
          return StateEnum.TAG_NAME;
        case CodePoints.TAB:
        case CodePoints.LF:
        case CodePoints.FF:
        case CodePoints.SPACE:
          this.currentTag.name = buffer.takeString();
          return StateEnum.BEFORE_ATTRIBUTE_NAME;
        case CodePoints.SLASH:
          this.currentTag.name = buffer.takeString();
          return StateEnum.SELF_CLOSING_START_TAG;
        case CodePoints.GT:
          this.currentTag.name = buffer.takeString();
          this.emitCurrentTag();
          return StateEnum.DATA;
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

  beforeAttributeName(code: number): StateEnum {
    while (true) {
      switch (code) {
        case CodePoints.EOC:
          this.paused = true;
          return StateEnum.BEFORE_ATTRIBUTE_NAME;
        case CodePoints.TAB:
        case CodePoints.LF:
        case CodePoints.FF:
        case CodePoints.SPACE:
          code = this.nextCode();
          break;
        case CodePoints.SLASH:
        case CodePoints.GT:
        case CodePoints.EOF:
          return this.callState(StateEnum.AFTER_ATTRIBUTE_NAME, code);
        case CodePoints.EQ:
          this.error('unexpected-equals-sign-before-attribute-name');
          this.startNewAttribute();
          this.buffer.append(code);
          return StateEnum.ATTRIBUTE_NAME;
        default:
          this.startNewAttribute();
          return this.callState(StateEnum.ATTRIBUTE_NAME, code);
      }
    }
  }

  attributeName(code: number): StateEnum {
    const buffer = this.buffer;
    while (true) {
      switch (code) {
        case CodePoints.EOC:
          this.paused = true;
          return StateEnum.ATTRIBUTE_NAME;
        case CodePoints.EQ:
          this.checkDuplicateAttribute(this.currentAttribute.name = buffer.takeString());
          return StateEnum.BEFORE_ATTRIBUTE_VALUE;
        case CodePoints.TAB:
        case CodePoints.LF:
        case CodePoints.FF:
        case CodePoints.SPACE:
        case CodePoints.GT:
        case CodePoints.SLASH:
        case CodePoints.EOF:
          this.checkDuplicateAttribute(this.currentAttribute.name = buffer.takeString());
          return this.callState(StateEnum.AFTER_ATTRIBUTE_NAME, code);
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
    if (this.currentAttributeNames.has(name)) {
      this.error('duplicate-attribute');
      this.currentTag.attributes.pop();
    } else
      this.currentAttributeNames.add(name);
  }

  afterAttributeName(code: number): StateEnum {
    while (true) {
      switch (code) {
        case CodePoints.EOC:
          this.paused = true;
          return StateEnum.AFTER_ATTRIBUTE_NAME;
        case CodePoints.EQ:
          return StateEnum.BEFORE_ATTRIBUTE_VALUE;
        case CodePoints.TAB:
        case CodePoints.LF:
        case CodePoints.FF:
        case CodePoints.SPACE:
          code = this.nextCode();
          break;
        case CodePoints.GT:
          this.emitCurrentTag();
          return StateEnum.DATA;
        case CodePoints.SLASH:
          return StateEnum.SELF_CLOSING_START_TAG;
        case CodePoints.EOF:
          this.error('eof-in-tag');
          return this.eof();
        default:
          this.startNewAttribute();
          return this.callState(StateEnum.ATTRIBUTE_NAME, code);
      }
    }
  }

  beforeAttributeValue(code: number): StateEnum {
    while (true) {
      switch (code) {
        case CodePoints.EOC:
          this.paused = true;
          return StateEnum.BEFORE_ATTRIBUTE_VALUE;
        case CodePoints.TAB:
        case CodePoints.LF:
        case CodePoints.FF:
        case CodePoints.SPACE:
          code = this.nextCode();
          break;
        case CodePoints.DOUBLE_QUOTE:
          return StateEnum.ATTRIBUTE_VALUE_DOUBLE_QUOTED;
        case CodePoints.SINGLE_QUOTE:
          return StateEnum.ATTRIBUTE_VALUE_SINGLE_QUOTED;
        case CodePoints.GT:
          this.error('missing-attribute-value');
          this.emitCurrentTag();
          return StateEnum.DATA;
        default:
          return this.callState(StateEnum.ATTRIBUTE_VALUE_UNQUOTED, code);
      }
    }
  }

  attributeValueDoubleQuoted(code: number): StateEnum {
    return this.attributeValueQuoted(code, CodePoints.DOUBLE_QUOTE);
  }

  attributeValueSingleQuoted(code: number): StateEnum {
    return this.attributeValueQuoted(code, CodePoints.SINGLE_QUOTE);
  }

  attributeValueQuoted(code: number, terminator: number): StateEnum {
    const buffer = this.buffer;
    while (true) {
      switch (code) {
        case CodePoints.EOC:
          this.paused = true;
          return terminator === CodePoints.DOUBLE_QUOTE ? StateEnum.ATTRIBUTE_VALUE_DOUBLE_QUOTED : StateEnum.ATTRIBUTE_VALUE_SINGLE_QUOTED;
        case terminator:
          this.currentAttribute.value = buffer.takeString();
          return StateEnum.AFTER_ATTRIBUTE_VALUE_QUOTED;
        case CodePoints.AMPERSAND:
          this.returnState = this.state;
          this.inAttribute = true;
          return StateEnum.CHARACTER_REFERENCE;
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

  attributeValueUnquoted(code: number): StateEnum {
    const buffer = this.buffer;
    while (true) {
      switch (code) {
        case CodePoints.EOC:
          this.paused = true;
          return StateEnum.ATTRIBUTE_VALUE_UNQUOTED;
        case CodePoints.TAB:
        case CodePoints.LF:
        case CodePoints.FF:
        case CodePoints.SPACE:
          this.currentAttribute.value = buffer.takeString();
          return StateEnum.BEFORE_ATTRIBUTE_NAME;
        case CodePoints.AMPERSAND:
          this.returnState = this.state;
          this.inAttribute = true;
          return StateEnum.CHARACTER_REFERENCE;
        case CodePoints.GT:
          this.currentAttribute.value = buffer.takeString();
          this.emitCurrentTag();
          return StateEnum.DATA;
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

  afterAttributeValueQuoted(code: number): StateEnum {
    switch (code) {
      case CodePoints.TAB:
      case CodePoints.LF:
      case CodePoints.FF:
      case CodePoints.SPACE:
        return StateEnum.BEFORE_ATTRIBUTE_NAME;
      case CodePoints.SLASH:
        return StateEnum.SELF_CLOSING_START_TAG;
      case CodePoints.GT:
        this.emitCurrentTag();
        return StateEnum.DATA;
      case CodePoints.EOF:
        this.error('eof-in-tag');
        return this.eof();
      default:
        this.error('missing-whitespace-between-attributes');
        return this.callState(StateEnum.BEFORE_ATTRIBUTE_NAME, code);
    }
  }

  selfClosingStartTag(code: number): StateEnum {
    switch (code) {
      case CodePoints.GT:
        this.currentTag.selfClosed = true;
        this.emitCurrentTag();
        return StateEnum.DATA;
      case CodePoints.EOF:
        this.error('eof-in-tag');
        return this.eof();
      default:
        this.error('unexpected-solidus-in-tag');
        return this.callState(StateEnum.BEFORE_ATTRIBUTE_NAME, code);
    }
  }

  // -----CDATA states-----
  cdataSectionStart(code: number): StateEnum {
    const adjustedNode = this.composer.adjustedCurrentNode;
    if (adjustedNode && adjustedNode.namespaceURI !== NS_HTML) {
      this.buffer.position = this.sequenceBufferOffset;
      return this.callState(StateEnum.CDATA_SECTION, code);
    }
    this.startNewComment();
    this.error('cdata-in-html-content');
    return this.bogusComment(code);
  }

  cdataSection(code: number): StateEnum {
    while (true) {
      switch (code) {
        case CodePoints.EOC:
          this.paused = true;
          return StateEnum.CDATA_SECTION;
        case CodePoints.CLOSE_SQUARE_BRACKET:
          return StateEnum.CDATA_SECTION_BRACKET;
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

  cdataSectionBracket(code: number): StateEnum {
    if (code === CodePoints.CLOSE_SQUARE_BRACKET)
      return StateEnum.CDATA_SECTION_END;
    else {
      this.appendNonWhitespace(CodePoints.CLOSE_SQUARE_BRACKET);
      return this.callState(StateEnum.CDATA_SECTION, code);
    }
  }

  cdataSectionEnd(code: number): StateEnum {
    while (true) {
      switch (code) {
        case CodePoints.EOC:
          this.paused = true;
          return StateEnum.CDATA_SECTION_END;
        case CodePoints.CLOSE_SQUARE_BRACKET:
          this.appendNonWhitespace(CodePoints.CLOSE_SQUARE_BRACKET);
          code = this.nextCode();
          break;
        case CodePoints.GT:
          this.emitCData();
          return StateEnum.DATA;
        default:
          this.appendNonWhitespace(CodePoints.CLOSE_SQUARE_BRACKET);
          this.appendNonWhitespace(CodePoints.CLOSE_SQUARE_BRACKET);
          return this.callState(StateEnum.CDATA_SECTION, code);
      }
    }
  }

  // -----character reference states-----
  characterReference(code: number): StateEnum {
    const buffer = this.buffer;
    this.referenceStartMark = buffer.position;
    if (this.inAttribute) buffer.append(CodePoints.AMPERSAND);
    else  // TODO this should be handled with respect to current whitespace mode
      this.appendNonWhitespace(CodePoints.AMPERSAND);
    if (code === CodePoints.SHARP) {
      if (this.inAttribute) buffer.append(CodePoints.SHARP);
      else this.appendNonWhitespace(CodePoints.SHARP);
      return StateEnum.NUMERIC_CHARACTER_REFERENCE;
    } else if (isAsciiAlphaNum(code)) {
      this.lastRefNode = this.refsIndex;
      this.lastMatch = 0;
      return this.callState(StateEnum.NAMED_CHARACTER_REFERENCE, code);
    } else
      return this.callState(this.returnState, code);
  }

  numericCharacterReference(code: number): StateEnum {
    this.charCode = 0;
    if (code === CodePoints.X_CAPITAL || code === CodePoints.X_REGULAR) {
      if (this.inAttribute) this.buffer.append(code);
      else this.appendNonWhitespace(code);
      return StateEnum.HEXADECIMAL_CHARACTER_REFERENCE_START;
    } else
      return this.callState(StateEnum.DECIMAL_CHARACTER_REFERENCE_START, code);
  }

  numericCharacterReferenceEnd(): void {
    const buffer = this.buffer;
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

  namedCharacterReference(code: number): StateEnum {
    const buffer = this.buffer;
    let node = this.lastRefNode, next: PrefixNode<number[]>;
    let lastMatch = this.lastMatch;
    while (node.children && (next = node.children[code])) {
      node = next;
      if (this.inAttribute) buffer.append(lastMatch = code);
      else this.appendNonWhitespace(lastMatch = code);
      if ((code = this.nextCode()) === CodePoints.EOC) {
        this.paused = true;
        this.lastRefNode = node;
        this.lastMatch = lastMatch;
        return StateEnum.NAMED_CHARACTER_REFERENCE;
      }
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
      return this.callState(StateEnum.AMBIGUOUS_AMPERSAND, code);
  }

  hexadecimalCharacterReferenceStart(code: number): StateEnum {
    if (!isHexDigit(code)) {
      this.error('absence-of-digits-in-numeric-character-reference');
      return this.callState(this.returnState, code);
    } else
      return this.callState(StateEnum.HEXADECIMAL_CHARACTER_REFERENCE, code);
  }

  hexadecimalCharacterReference(code: number): StateEnum {
    while (true) {
      if (code === CodePoints.EOC) {
        this.paused = true;
        return StateEnum.HEXADECIMAL_CHARACTER_REFERENCE;
      } else if (code === CodePoints.SEMICOLON) {
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

  decimalCharacterReferenceStart(code: number): StateEnum {
    if (!isDigit(code)) {
      this.error('absence-of-digits-in-numeric-character-reference');
      return this.callState(this.returnState, code);
    } else
      return this.callState(StateEnum.DECIMAL_CHARACTER_REFERENCE, code);
  }

  decimalCharacterReference(code: number): StateEnum {
    while (true) {
      switch (code) {
        case CodePoints.EOC:
          this.paused = true;
          return StateEnum.DECIMAL_CHARACTER_REFERENCE;
        case CodePoints.SEMICOLON:
          this.numericCharacterReferenceEnd();
          return this.returnState;
        default:
          if (isDigit(code)) {
            this.charCode = this.charCode * 10 + code - 0x30;
          } else {
            this.error('missing-semicolon-after-character-reference');
            this.numericCharacterReferenceEnd();
            return this.callState(this.returnState, code);
          }
          code = this.nextCode();
      }
    }
  }

  ambiguousAmpersand(code: number): StateEnum {
    const buffer = this.buffer;
    while (true) {
      switch (code) {
        case CodePoints.EOC:
          this.paused = true;
          return StateEnum.AMBIGUOUS_AMPERSAND;
        case CodePoints.SEMICOLON:
          this.error('unknown-named-character-reference');
          return this.callState(this.returnState, code);
        default:
          if (isAsciiAlphaNum(code)) {
            if (this.inAttribute)
              buffer.append(code);
            else
              this.appendNonWhitespace(code);
            code = this.nextCode();
          } else
            return this.callState(this.returnState, code);
      }
    }
  }

  // -----comment states-----
  commentStart(code: number): StateEnum {
    this.buffer.position = this.sequenceBufferOffset;
    this.startNewComment();
    switch (code) {
      case CodePoints.HYPHEN:
        return StateEnum.COMMENT_START_DASH;
      case CodePoints.GT:
        this.error('abrupt-closing-of-empty-comment');
        this.emitCurrentComment();
        return StateEnum.DATA;
      default:
        return this.callState(StateEnum.COMMENT, code);
    }
  }

  commentStartDash(code: number): StateEnum {
    switch (code) {
      case CodePoints.HYPHEN:
        return StateEnum.COMMENT_END;
      case CodePoints.GT:
        this.error('abrupt-closing-of-empty-comment');
        this.emitCurrentComment();
        return StateEnum.DATA;
      case CodePoints.EOF:
        this.error('eof-in-comment');
        this.emitCurrentComment();
        return this.eof();
      default:
        this.buffer.append(CodePoints.HYPHEN);
        return this.callState(StateEnum.COMMENT, code);
    }
  }

  comment(code: number): StateEnum {
    const buffer = this.buffer;
    while (true) {
      switch (code) {
        case CodePoints.EOC:
          this.paused = true;
          return StateEnum.COMMENT;
        case CodePoints.LT:
          buffer.append(code);
          return StateEnum.COMMENT_LESS_THAN_SIGN;
        case CodePoints.HYPHEN:
          return StateEnum.COMMENT_END_DASH;
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

  commentLessThanSign(code: number): StateEnum {
    const buffer = this.buffer;
    while (true) {
      switch (code) {
        case CodePoints.EOC:
          this.paused = true;
          return StateEnum.COMMENT_LESS_THAN_SIGN;
        case CodePoints.EXCLAMATION:
          buffer.append(code);
          return StateEnum.COMMENT_LESS_THAN_SIGN_BANG;
        case CodePoints.LT:
          buffer.append(code);
          code = this.nextCode();
          break;
        default:
          return this.callState(StateEnum.COMMENT, code);
      }
    }
  }

  commentLessThanSignBang(code: number): StateEnum {
    if (code === CodePoints.HYPHEN)
      return StateEnum.COMMENT_LESS_THAN_SIGN_BANG_DASH;
    else
      return this.callState(StateEnum.COMMENT, code);
  }

  commentLessThanSignBangDash(code: number): StateEnum {
    if (code === CodePoints.HYPHEN)
      return StateEnum.COMMENT_LESS_THAN_SIGN_BANG_DASH_DASH;
    else
      return this.callState(StateEnum.COMMENT_END_DASH, code);
  }

  commentLessThanSignBangDashDash(code: number): StateEnum {
    if (code !== CodePoints.GT && code !== CodePoints.EOF)
      this.error('nested-comment');
    return this.callState(StateEnum.COMMENT_END, code);
  }

  commentEndDash(code: number): StateEnum {
    switch (code) {
      case CodePoints.HYPHEN:
        return StateEnum.COMMENT_END;
      case CodePoints.EOF:
        // by the spec extra dash is NOT appended here
        // so unfinished comments ending with single dash do NOT include that dash in data
        this.error('eof-in-comment');
        this.emitCurrentComment();
        return this.eof();
      default:
        this.buffer.append(CodePoints.HYPHEN);
        return this.callState(StateEnum.COMMENT, code);
    }
  }

  commentEnd(code: number): StateEnum {
    const buffer = this.buffer;
    while (true) {
      switch (code) {
        case CodePoints.EOC:
          this.paused = true;
          return StateEnum.COMMENT_END;
        case CodePoints.GT:
          this.emitCurrentComment();
          return StateEnum.DATA;
        case CodePoints.EXCLAMATION:
          return StateEnum.COMMENT_END_BANG;
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
          return this.callState(StateEnum.COMMENT, code);
      }
    }
  }

  commentEndBang(code: number): StateEnum {
    const buffer = this.buffer;
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
        return StateEnum.COMMENT_END_DASH;
      case CodePoints.GT:
        this.error('incorrectly-closed-comment');
        this.emitCurrentComment();
        return StateEnum.DATA;
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
        return this.callState(StateEnum.COMMENT, code);
    }
  }

  bogusComment(code: number): StateEnum {
    const buffer = this.buffer;
    while (true) {
      switch (code) {
        case CodePoints.EOC:
          this.paused = true;
          return StateEnum.BOGUS_COMMENT;
        case CodePoints.GT:
          this.emitCurrentComment();
          return StateEnum.DATA;
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

  markupDeclarationOpen(code: number): StateEnum {
    this.emitAccumulatedCharacters();
    switch (code) {
      case CodePoints.HYPHEN:
        return this.matchSequence(code, TWO_HYPHENS, false, StateEnum.COMMENT_START, StateEnum.MARKUP_DECLARATION_FAIL);
      case 0x44: // D
      case 0x64: // d
        return this.matchSequence(code, DOCTYPE, true, StateEnum.DOCTYPE, StateEnum.MARKUP_DECLARATION_FAIL);
      case CodePoints.OPEN_SQUARE_BRACKET:
        return this.matchSequence(code, CDATA, false, StateEnum.CDATA_SECTION_START, StateEnum.MARKUP_DECLARATION_FAIL);
      default:
        return this.callState(StateEnum.MARKUP_DECLARATION_FAIL, code);
    }
  }

  markupDeclarationFail(code: number): StateEnum {
    this.startNewComment();
    this.error('incorrectly-opened-comment');
    return this.callState(StateEnum.BOGUS_COMMENT, code);
  }

  // -----doctype states-----
  doctype(code: number): StateEnum {
    this.buffer.position = this.sequenceBufferOffset;
    this.emitAccumulatedCharacters();
    this.startNewDoctype();
    switch (code) {
      case CodePoints.TAB:
      case CodePoints.LF:
      case CodePoints.FF:
      case CodePoints.SPACE:
        return StateEnum.BEFORE_DOCTYPE_NAME;
      case CodePoints.EOF:
        return this.eofInDoctype();
      default:
        this.error('missing-whitespace-before-doctype-name');
      case CodePoints.GT:
        return this.callState(StateEnum.BEFORE_DOCTYPE_NAME, code);
    }
  }

  beforeDoctypeName(code: number): StateEnum {
    const buffer = this.buffer;
    while (true) {
      switch (code) {
        case CodePoints.EOC:
          this.paused = true;
          return StateEnum.BEFORE_DOCTYPE_NAME;
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
          return StateEnum.DATA;
        case CodePoints.EOF:
          return this.eofInDoctype();
        case CodePoints.NUL:
          this.error('unexpected-null-character');
          code = CodePoints.REPLACEMENT_CHAR;
        default:
          if (isAsciiUpperAlpha(code)) code += 0x20;
          buffer.append(code);
          return StateEnum.DOCTYPE_NAME;
      }
    }
  }

  doctypeName(code: number): StateEnum {
    const buffer = this.buffer;
    while (true) {
      switch (code) {
        case CodePoints.EOC:
          this.paused = true;
          return StateEnum.DOCTYPE_NAME;
        case CodePoints.TAB:
        case CodePoints.LF:
        case CodePoints.FF:
        case CodePoints.SPACE:
          this.currentDoctype.name = buffer.takeString();
          return StateEnum.AFTER_DOCTYPE_NAME;
        case CodePoints.GT:
          this.currentDoctype.name = buffer.takeString();
          this.emitCurrentDoctype();
          return StateEnum.DATA;
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

  afterDoctypeName(code: number): StateEnum {
    while (true) {
      switch (code) {
        case CodePoints.EOC:
          this.paused = true;
          return StateEnum.AFTER_DOCTYPE_NAME;
        case CodePoints.TAB:
        case CodePoints.LF:
        case CodePoints.FF:
        case CodePoints.SPACE:
          code = this.nextCode();
          break;
        case CodePoints.GT:
          this.emitCurrentDoctype();
          return StateEnum.DATA;
        case CodePoints.EOF:
          return this.eofInDoctype();
        case 0x50: // P
        case 0x70: // p
          return this.matchSequence(code, PUBLIC, true, StateEnum.AFTER_DOCTYPE_PUBLIC_KEYWORD, StateEnum.AFTER_DOCTYPE_NAME_FAILED_SEQUENCE);
        case 0x53: // S
        case 0x73: // s
          return this.matchSequence(code, SYSTEM, true, StateEnum.AFTER_DOCTYPE_SYSTEM_KEYWORD, StateEnum.AFTER_DOCTYPE_NAME_FAILED_SEQUENCE);
        default:
          return this.callState(StateEnum.AFTER_DOCTYPE_NAME_FAILED_SEQUENCE, code);
      }
    }
  }

  afterDoctypeNameFailedSequence(code: number): StateEnum {
    this.buffer.position = this.sequenceBufferOffset;
    this.currentDoctype.forceQuirks = true;
    this.error('invalid-character-sequence-after-doctype-name');
    return this.callState(StateEnum.BOGUS_DOCTYPE, code);
  }

  afterDoctypePublicKeyword(code: number): StateEnum {
    this.buffer.position = this.sequenceBufferOffset;
    switch (code) {
      case CodePoints.TAB:
      case CodePoints.LF:
      case CodePoints.FF:
      case CodePoints.SPACE:
        return StateEnum.BEFORE_DOCTYPE_PUBLIC_IDENTIFIER;
      case CodePoints.DOUBLE_QUOTE:
        this.error('missing-whitespace-after-doctype-public-keyword');
        return StateEnum.DOCTYPE_PUBLIC_IDENTIFIER_DOUBLE_QUOTED;
      case CodePoints.SINGLE_QUOTE:
        this.error('missing-whitespace-after-doctype-public-keyword');
        return StateEnum.DOCTYPE_PUBLIC_IDENTIFIER_SINGLE_QUOTED;
      case CodePoints.GT:
        this.currentDoctype.forceQuirks = true;
        this.error('missing-doctype-public-identifier');
        this.emitCurrentDoctype();
        return StateEnum.DATA;
      case CodePoints.EOF:
        return this.eofInDoctype();
      default:
        this.currentDoctype.forceQuirks = true;
        this.error('missing-quote-before-doctype-public-identifier');
        return this.callState(StateEnum.BOGUS_DOCTYPE, code);
    }
  }

  beforeDoctypePublicIdentifier(code: number): StateEnum {
    while (true) {
      switch (code) {
        case CodePoints.EOC:
          this.paused = true;
          return StateEnum.BEFORE_DOCTYPE_PUBLIC_IDENTIFIER;
        case CodePoints.TAB:
        case CodePoints.LF:
        case CodePoints.FF:
        case CodePoints.SPACE:
          code = this.nextCode();
          break;
        case CodePoints.DOUBLE_QUOTE:
          return StateEnum.DOCTYPE_PUBLIC_IDENTIFIER_DOUBLE_QUOTED;
        case CodePoints.SINGLE_QUOTE:
          return StateEnum.DOCTYPE_PUBLIC_IDENTIFIER_SINGLE_QUOTED;
        case CodePoints.GT:
          this.currentDoctype.forceQuirks = true;
          this.error('missing-doctype-public-identifier');
          this.emitCurrentDoctype();
          return StateEnum.DATA;
        case CodePoints.EOF:
          return this.eofInDoctype();
        default:
          this.currentDoctype.forceQuirks = true;
          this.error('missing-quote-before-doctype-public-identifier');
          return this.callState(StateEnum.BOGUS_DOCTYPE, code);
      }
    }
  }

  doctypePublicIdentifierDoubleQuoted(code: number): StateEnum {
    return this.doctypePublicIdentifierQuoted(code, CodePoints.DOUBLE_QUOTE);
  }

  doctypePublicIdentifierSingleQuoted(code: number): StateEnum {
    return this.doctypePublicIdentifierQuoted(code, CodePoints.SINGLE_QUOTE);
  }

  doctypePublicIdentifierQuoted(code: number, terminator: number): StateEnum {
    const buffer = this.buffer;
    while (true) {
      switch (code) {
        case CodePoints.EOC:
          this.paused = true;
          return terminator === CodePoints.DOUBLE_QUOTE ? StateEnum.DOCTYPE_PUBLIC_IDENTIFIER_DOUBLE_QUOTED : StateEnum.DOCTYPE_PUBLIC_IDENTIFIER_SINGLE_QUOTED;
        case terminator:
          this.currentDoctype.publicId = buffer.takeString();
          return StateEnum.AFTER_DOCTYPE_PUBLIC_IDENTIFIER;
        case CodePoints.GT:
          this.currentDoctype.publicId = buffer.takeString();
          this.currentDoctype.forceQuirks = true;
          this.error('abrupt-doctype-public-identifier');
          this.emitCurrentDoctype();
          return StateEnum.DATA;
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

  afterDoctypePublicIdentifier(code: number): StateEnum {
    switch (code) {
      case CodePoints.TAB:
      case CodePoints.LF:
      case CodePoints.FF:
      case CodePoints.SPACE:
        return StateEnum.BETWEEN_DOCTYPE_PUBLIC_AND_SYSTEM_IDENTIFIERS;
      case CodePoints.GT:
        this.emitCurrentDoctype();
        return StateEnum.DATA;
      case CodePoints.DOUBLE_QUOTE:
        this.error('missing-whitespace-between-doctype-public-and-system-identifiers');
        return StateEnum.DOCTYPE_SYSTEM_IDENTIFIER_DOUBLE_QUOTED;
      case CodePoints.SINGLE_QUOTE:
        this.error('missing-whitespace-between-doctype-public-and-system-identifiers');
        return StateEnum.DOCTYPE_SYSTEM_IDENTIFIER_SINGLE_QUOTED;
      case CodePoints.EOF:
        return this.eofInDoctype();
      default:
        this.currentDoctype.forceQuirks = true;
        this.error('missing-quote-before-doctype-system-identifier');
        return this.callState(StateEnum.BOGUS_DOCTYPE, code);
    }
  }

  betweenDoctypePublicAndSystemIdentifiers(code: number): StateEnum {
    while (true) {
      switch (code) {
        case CodePoints.EOC:
          this.paused = true;
          return StateEnum.BETWEEN_DOCTYPE_PUBLIC_AND_SYSTEM_IDENTIFIERS;
        case CodePoints.TAB:
        case CodePoints.LF:
        case CodePoints.FF:
        case CodePoints.SPACE:
          code = this.nextCode();
          break;
        case CodePoints.DOUBLE_QUOTE:
          return StateEnum.DOCTYPE_SYSTEM_IDENTIFIER_DOUBLE_QUOTED;
        case CodePoints.SINGLE_QUOTE:
          return StateEnum.DOCTYPE_SYSTEM_IDENTIFIER_SINGLE_QUOTED;
        case CodePoints.GT:
          this.emitCurrentDoctype();
          return StateEnum.DATA;
        case CodePoints.EOF:
          return this.eofInDoctype();
        default:
          this.currentDoctype.forceQuirks = true;
          this.error('missing-quote-before-doctype-system-identifier');
          return this.callState(StateEnum.BOGUS_DOCTYPE, code);
      }
    }
  }

  afterDoctypeSystemKeyword(code: number): StateEnum {
    this.buffer.position = this.sequenceBufferOffset;
    switch (code) {
      case CodePoints.TAB:
      case CodePoints.LF:
      case CodePoints.FF:
      case CodePoints.SPACE:
        return StateEnum.BEFORE_DOCTYPE_SYSTEM_IDENTIFIER;
      case CodePoints.DOUBLE_QUOTE:
        this.error('missing-whitespace-after-doctype-system-keyword');
        return StateEnum.DOCTYPE_SYSTEM_IDENTIFIER_DOUBLE_QUOTED;
      case CodePoints.SINGLE_QUOTE:
        this.error('missing-whitespace-after-doctype-system-keyword');
        return StateEnum.DOCTYPE_SYSTEM_IDENTIFIER_SINGLE_QUOTED;
      case CodePoints.GT:
        this.currentDoctype.forceQuirks = true;
        this.error('missing-doctype-system-identifier');
        this.emitCurrentDoctype();
        return StateEnum.DATA;
      case CodePoints.EOF:
        return this.eofInDoctype();
      default:
        this.currentDoctype.forceQuirks = true;
        this.error('missing-quote-before-doctype-system-identifier');
        return this.callState(StateEnum.BOGUS_DOCTYPE, code);
    }
  }

  beforeDoctypeSystemIdentifier(code: number): StateEnum {
    while (true) {
      switch (code) {
        case CodePoints.EOC:
          this.paused = true;
          return StateEnum.BEFORE_DOCTYPE_SYSTEM_IDENTIFIER;
        case CodePoints.TAB:
        case CodePoints.LF:
        case CodePoints.FF:
        case CodePoints.SPACE:
          code = this.nextCode();
          break;
        case CodePoints.DOUBLE_QUOTE:
          return StateEnum.DOCTYPE_SYSTEM_IDENTIFIER_DOUBLE_QUOTED;
        case CodePoints.SINGLE_QUOTE:
          return StateEnum.DOCTYPE_SYSTEM_IDENTIFIER_SINGLE_QUOTED;
        case CodePoints.GT:
          this.currentDoctype.forceQuirks = true;
          this.error('missing-doctype-system-identifier');
          this.emitCurrentDoctype();
          return StateEnum.DATA;
        case CodePoints.EOF:
          return this.eofInDoctype();
        default:
          this.currentDoctype.forceQuirks = true;
          this.error('missing-quote-before-doctype-system-identifier');
          return this.callState(StateEnum.BOGUS_DOCTYPE, code);
      }
    }
  }

  doctypeSystemIdentifierDoubleQuoted(code: number): StateEnum {
    return this.doctypeSystemIdentifierQuoted(code, CodePoints.DOUBLE_QUOTE);
  }
  doctypeSystemIdentifierSingleQuoted(code: number): StateEnum {
    return this.doctypeSystemIdentifierQuoted(code, CodePoints.SINGLE_QUOTE);
  }

  doctypeSystemIdentifierQuoted(code: number, terminator: number): StateEnum {
    const buffer = this.buffer;
    while (true) {
      switch (code) {
        case CodePoints.EOC:
          this.paused = true;
          return terminator === CodePoints.DOUBLE_QUOTE ? StateEnum.DOCTYPE_SYSTEM_IDENTIFIER_DOUBLE_QUOTED : StateEnum.DOCTYPE_SYSTEM_IDENTIFIER_SINGLE_QUOTED;
        case terminator:
          this.currentDoctype.systemId = buffer.takeString();
          return StateEnum.AFTER_DOCTYPE_SYSTEM_IDENTIFIER;
        case CodePoints.GT:
          this.currentDoctype.systemId = buffer.takeString();
          this.currentDoctype.forceQuirks = true;
          this.error('abrupt-doctype-system-identifier');
          this.emitCurrentDoctype();
          return StateEnum.DATA;
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

  afterDoctypeSystemIdentifier(code: number): StateEnum {
    while (true) {
      switch (code) {
        case CodePoints.EOC:
          this.paused = true;
          return StateEnum.AFTER_DOCTYPE_SYSTEM_IDENTIFIER;
        case CodePoints.TAB:
        case CodePoints.LF:
        case CodePoints.FF:
        case CodePoints.SPACE:
          code = this.nextCode();
          break;
        case CodePoints.GT:
          this.emitCurrentDoctype();
          return StateEnum.DATA;
        case CodePoints.EOF:
          return this.eofInDoctype();
        default:
          this.error('unexpected-character-after-doctype-system-identifier');
          return this.callState(StateEnum.BOGUS_DOCTYPE, code);
      }
    }
  }

  bogusDoctype(code: number): StateEnum {
    while (true) {
      switch (code) {
        case CodePoints.EOC:
          this.paused = true;
          return StateEnum.BOGUS_DOCTYPE;
        case CodePoints.GT:
          this.emitCurrentDoctype()
          return StateEnum.DATA;
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
  scriptData(code: number): StateEnum {
    return this.textDataNoRefs(code, StateEnum.SCRIPT_DATA_LESS_THAN_SIGN, StateEnum.SCRIPT_DATA);
  }

  scriptDataLessThanSign(code: number): StateEnum {
    switch (code) {
      case CodePoints.SLASH:
        return StateEnum.SCRIPT_DATA_END_TAG_OPEN;
      case CodePoints.EXCLAMATION:
        this.appendNonWhitespace(CodePoints.LT);
        this.appendNonWhitespace(CodePoints.EXCLAMATION);
        return StateEnum.SCRIPT_DATA_ESCAPE_START;
      default:
        this.appendNonWhitespace(CodePoints.LT);
        return this.callState(StateEnum.SCRIPT_DATA, code);
    }
  }

  scriptDataEndTagOpen(code: number): StateEnum {
    return this.textDataEndTagOpen(code, StateEnum.SCRIPT_DATA_END_TAG_NAME, StateEnum.SCRIPT_DATA);
  }

  scriptDataEndTagName(code: number): StateEnum {
    return this.matchSequence(code, SCRIPT, true, StateEnum.SCRIPT_DATA_END_TAG_NAME_MATCHED, StateEnum.SCRIPT_DATA);
  }

  scriptDataEndTagNameMatched(code: number): StateEnum {
    return this.textDataEndTagMatched(code, StateEnum.SCRIPT_DATA);
  }

  scriptDataEscapeStart(code: number): StateEnum {
    if (code === CodePoints.HYPHEN) {
      this.appendNonWhitespace(code);
      return StateEnum.SCRIPT_DATA_ESCAPE_START_DASH;
    } else
      return this.callState(StateEnum.SCRIPT_DATA, code);
  }

  scriptDataEscapeStartDash(code: number): StateEnum {
    if (code === CodePoints.HYPHEN) {
      this.appendNonWhitespace(code);
      return StateEnum.SCRIPT_DATA_ESCAPED_DASH_DASH;
    } else
      return this.callState(StateEnum.SCRIPT_DATA, code);
  }

  scriptDataEscaped(code: number): StateEnum {
    while (true) {
      switch (code) {
        case CodePoints.EOC:
          this.paused = true;
          return StateEnum.SCRIPT_DATA_ESCAPED;
        case CodePoints.HYPHEN:
          this.appendNonWhitespace(code);
          return StateEnum.SCRIPT_DATA_ESCAPED_DASH;
        case CodePoints.LT:
          return StateEnum.SCRIPT_DATA_ESCAPED_LESS_THAN_SIGN;
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

  scriptDataEscapedDash(code: number): StateEnum {
    switch (code) {
      case CodePoints.HYPHEN:
        this.appendNonWhitespace(code);
        return StateEnum.SCRIPT_DATA_ESCAPED_DASH_DASH;
      case CodePoints.LT:
        return StateEnum.SCRIPT_DATA_ESCAPED_LESS_THAN_SIGN;
      case CodePoints.EOF:
        this.error('eof-in-script-html-comment-like-text');
        this.emitAccumulatedCharacters();
        return this.eof();
      case CodePoints.NUL:
        this.error('unexpected-null-character');
        code = CodePoints.REPLACEMENT_CHAR;
      default:
        this.appendCharacter(code);
        return StateEnum.SCRIPT_DATA_ESCAPED;
    }
  }

  scriptDataEscapedDashDash(code: number): StateEnum {
    while (true) {
      switch (code) {
        case CodePoints.EOC:
          this.paused = true;
          return StateEnum.SCRIPT_DATA_ESCAPED_DASH_DASH;
        case CodePoints.HYPHEN:
          this.appendNonWhitespace(code);
          code = this.nextCode();
          break;
        case CodePoints.LT:
          return StateEnum.SCRIPT_DATA_ESCAPED_LESS_THAN_SIGN;
        case CodePoints.GT:
          this.appendNonWhitespace(code);
          return StateEnum.SCRIPT_DATA;
        case CodePoints.EOF:
          this.error('eof-in-script-html-comment-like-text');
          this.emitAccumulatedCharacters();
          return this.eof();
        case CodePoints.NUL:
          this.error('unexpected-null-character');
          code = CodePoints.REPLACEMENT_CHAR;
        default:
          this.appendCharacter(code);
          return StateEnum.SCRIPT_DATA_ESCAPED;
      }
    }
  }

  scriptDataEscapedLessThanSign(code: number): StateEnum {
    if (code === CodePoints.SLASH) {
      return StateEnum.SCRIPT_DATA_ESCAPED_END_TAG_OPEN;
    } else if (isAsciiAlpha(code)) {
      this.appendNonWhitespace(CodePoints.LT);
      return this.scriptDataDoubleEscapeStart(code);
    } else {
      this.appendNonWhitespace(CodePoints.LT);
      return this.callState(StateEnum.SCRIPT_DATA_ESCAPED, code);
    }
  }

  scriptDataEscapedEndTagOpen(code: number): StateEnum {
    return this.textDataEndTagOpen(code, StateEnum.SCRIPT_DATA_ESCAPED_END_TAG_NAME, StateEnum.SCRIPT_DATA_ESCAPED);
  }

  scriptDataEscapedEndTagName(code: number): StateEnum {
    return this.matchSequence(code, SCRIPT, true, StateEnum.SCRIPT_DATA_END_TAG_NAME_MATCHED, StateEnum.SCRIPT_DATA_ESCAPED);
  }

  scriptDataDoubleEscapeStart(code: number): StateEnum {
    return this.matchSequence(code, SCRIPT, true, StateEnum.SCRIPT_DATA_DOUBLE_ESCAPE_START_MATCHED, StateEnum.SCRIPT_DATA_ESCAPED);
  }

  scriptDataDoubleEscapeStartMatched(code: number): StateEnum {
    switch (code) {
      case CodePoints.TAB:
      case CodePoints.LF:
      case CodePoints.FF:
      case CodePoints.SPACE:
        this.appendWhitespace(code);
        return StateEnum.SCRIPT_DATA_DOUBLE_ESCAPED;
      case CodePoints.SLASH:
      case CodePoints.GT:
        this.appendNonWhitespace(code);
        return StateEnum.SCRIPT_DATA_DOUBLE_ESCAPED;
      default:
        return this.callState(StateEnum.SCRIPT_DATA_ESCAPED, code);
    }
  }

  scriptDataDoubleEscaped(code: number): StateEnum {
    while (true) {
      switch (code) {
        case CodePoints.EOC:
          this.paused = true;
          return StateEnum.SCRIPT_DATA_DOUBLE_ESCAPED;
        case CodePoints.HYPHEN:
          this.appendNonWhitespace(code);
          return StateEnum.SCRIPT_DATA_DOUBLE_ESCAPED_DASH;
        case CodePoints.LT:
          this.appendNonWhitespace(code);
          return StateEnum.SCRIPT_DATA_DOUBLE_ESCAPED_LESS_THAN_SIGN;
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

  scriptDataDoubleEscapedDash(code: number): StateEnum {
    switch (code) {
      case CodePoints.HYPHEN:
        this.appendNonWhitespace(code);
        return StateEnum.SCRIPT_DATA_DOUBLE_ESCAPED_DASH_DASH;
      case CodePoints.LT:
        this.appendNonWhitespace(code);
        return StateEnum.SCRIPT_DATA_DOUBLE_ESCAPED_LESS_THAN_SIGN;
      case CodePoints.NUL:
        this.error('unexpected-null-character');
        this.appendNonWhitespace(CodePoints.REPLACEMENT_CHAR);
        return StateEnum.SCRIPT_DATA_DOUBLE_ESCAPED;
      case CodePoints.EOF:
        this.error('eof-in-script-html-comment-like-text');
        this.emitAccumulatedCharacters();
        return this.eof();
      default:
        this.appendCharacter(code);
        return StateEnum.SCRIPT_DATA_DOUBLE_ESCAPED;
    }
  }

  scriptDataDoubleEscapedDashDash(code: number): StateEnum {
    while (true) {
      switch (code) {
        case CodePoints.EOC:
          this.paused = true;
          return StateEnum.SCRIPT_DATA_DOUBLE_ESCAPED_DASH_DASH;
        case CodePoints.HYPHEN:
          this.appendNonWhitespace(code);
          code = this.nextCode();
          break;
        case CodePoints.LT:
          this.appendNonWhitespace(code);
          return StateEnum.SCRIPT_DATA_DOUBLE_ESCAPED_LESS_THAN_SIGN;
        case CodePoints.GT:
          this.appendNonWhitespace(code);
          return StateEnum.SCRIPT_DATA;
        case CodePoints.NUL:
          this.error('unexpected-null-character');
          this.appendNonWhitespace(CodePoints.REPLACEMENT_CHAR);
          return StateEnum.SCRIPT_DATA_DOUBLE_ESCAPED;
        case CodePoints.EOF:
          this.error('eof-in-script-html-comment-like-text');
          this.emitAccumulatedCharacters();
          return this.eof();
        default:
          this.appendCharacter(code);
          return StateEnum.SCRIPT_DATA_DOUBLE_ESCAPED;
      }
    }
  }

  scriptDataDoubleEscapedLessThanSign(code: number): StateEnum {
    if (code === CodePoints.SLASH) {
      this.appendNonWhitespace(code);
      return StateEnum.SCRIPT_DATA_DOUBLE_ESCAPE_END;
    } else {
      return this.callState(StateEnum.SCRIPT_DATA_DOUBLE_ESCAPED, code);
    }
  }

  scriptDataDoubleEscapeEnd(code: number) {
    return this.matchSequence(code, SCRIPT, true, StateEnum.SCRIPT_DATA_DOUBLE_ESCAPE_END_MATCHED, StateEnum.SCRIPT_DATA_DOUBLE_ESCAPED);
  }

  scriptDataDoubleEscapeEndMatched(code: number): StateEnum {
    switch (code) {
      case CodePoints.TAB:
      case CodePoints.LF:
      case CodePoints.FF:
      case CodePoints.SPACE:
        this.appendWhitespace(code);
        return StateEnum.SCRIPT_DATA_ESCAPED;
      case CodePoints.SLASH:
      case CodePoints.GT:
        this.appendNonWhitespace(code);
        return StateEnum.SCRIPT_DATA_ESCAPED;
      default:
        return this.callState(StateEnum.SCRIPT_DATA_DOUBLE_ESCAPED, code);
    }
  }
  // -----text states-----
  rawtext(code: number): StateEnum {
    return this.textDataNoRefs(code, StateEnum.RAWTEXT_LESS_THAN_SIGN, StateEnum.RAWTEXT);
  }

  rawtextLessThanSign(code: number): StateEnum {
    return this.textDataLessThanSign(code, StateEnum.RAWTEXT_END_TAG_OPEN, StateEnum.RAWTEXT, StateEnum.RAWTEXT_LESS_THAN_SIGN);
  }

  rawtextEndTagOpen(code: number): StateEnum {
    return this.textDataEndTagOpen(code, StateEnum.RAWTEXT_END_TAG_NAME, StateEnum.RAWTEXT);
  }

  rawtextEndTagName(code: number): StateEnum {
    return this.matchSequence(code, stringToArray(this.lastOpenTag!), true, StateEnum.RAWTEXT_END_TAG_NAME_MATCHED, StateEnum.RAWTEXT);
  }

  rawtextEndTagNameMatched(code: number): StateEnum {
    return this.textDataEndTagMatched(code, StateEnum.RAWTEXT);
  }

  rcdata(code: number): StateEnum {
    while (true) {
      switch (code) {
        case CodePoints.EOC:
          this.paused = true;
          return StateEnum.RCDATA;
        case CodePoints.AMPERSAND:
          this.returnState = this.state;
          this.inAttribute = false;
          return StateEnum.CHARACTER_REFERENCE;
        case CodePoints.LT:
          return StateEnum.RCDATA_LESS_THAN_SIGN;
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

  rcdataLessThanSign(code: number): StateEnum {
    return this.textDataLessThanSign(code, StateEnum.RCDATA_END_TAG_OPEN, StateEnum.RCDATA, StateEnum.RCDATA_LESS_THAN_SIGN);
  }

  rcdataEndTagOpen(code: number): StateEnum {
    return this.textDataEndTagOpen(code, StateEnum.RCDATA_END_TAG_NAME, StateEnum.RCDATA);
  }

  rcdataEndTagName(code: number): StateEnum {
    return this.matchSequence(code, stringToArray(this.lastOpenTag!), true, StateEnum.RCDATA_END_TAG_NAME_MATCHED, StateEnum.RCDATA);
  }

  rcdataEndTagNameMatched(code: number): StateEnum {
    return this.textDataEndTagMatched(code, StateEnum.RCDATA);
  }
}