import {CharacterSource} from '../interfaces/CharacterSource.js';
import {CodePoints} from '../interfaces/CodePoints.js';
import {Element} from '../interfaces/dom-types.js';
import {ErrorHandler, ignoring} from '../interfaces/ErrorHandler.js';
import {PrefixNode} from '../interfaces/PrefixNode.js';
import {FixedSizeStringBuilder} from './FixedSizeStringBuilder.js';
import {State} from './interfaces/states.js';
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
  state!: State;
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
  sequencePositiveState!: State;
  sequenceNegativeState!: State;

  textEndMark!: number;

  returnState!: State;
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
    this.state = State.DATA;
    this.active = true;
    this.paused = false;
    this.lastOpenTag = undefined;
    this.tokenQueue.length = 0;
    this.currentAttributeNames.clear();
    this.sequenceBufferOffset = undefined as unknown as number;
    this.sequenceData = undefined as unknown as number[];
    this.sequenceIndex = undefined as unknown as number;
    this.sequencePositiveState = undefined as unknown as State;
    this.sequenceNegativeState = undefined as unknown as State;
    this.textEndMark = undefined as unknown as number;
    this.returnState = undefined as unknown as State;
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

  execState(state: State, code: number): State {
    switch (state) {
// @formatter:off
      case State.EOF: return this.eof();
      case State.DATA: return this.data(code);
      case State.RCDATA: return this.rcdata(code);
      case State.RAWTEXT: return this.rawtext(code);
      case State.SCRIPT_DATA: return this.scriptData(code);
      case State.PLAINTEXT: return this.plaintext(code);
      case State.TAG_OPEN: return this.tagOpen(code);
      case State.END_TAG_OPEN: return this.endTagOpen(code);
      case State.TAG_NAME: return this.tagName(code);
      case State.RCDATA_LESS_THAN_SIGN: return this.rcdataLessThanSign(code);
      case State.RCDATA_END_TAG_OPEN: return this.rcdataEndTagOpen(code);
      case State.RCDATA_END_TAG_NAME: return this.rcdataEndTagName(code);
      case State.RCDATA_END_TAG_NAME_MATCHED: return this.rcdataEndTagNameMatched(code);
      case State.RAWTEXT_LESS_THAN_SIGN: return this.rawtextLessThanSign(code);
      case State.RAWTEXT_END_TAG_OPEN: return this.rawtextEndTagOpen(code);
      case State.RAWTEXT_END_TAG_NAME: return this.rawtextEndTagName(code);
      case State.RAWTEXT_END_TAG_NAME_MATCHED: return this.rawtextEndTagNameMatched(code);
      case State.SCRIPT_DATA_LESS_THAN_SIGN: return this.scriptDataLessThanSign(code);
      case State.SCRIPT_DATA_END_TAG_OPEN: return this.scriptDataEndTagOpen(code);
      case State.SCRIPT_DATA_END_TAG_NAME: return this.scriptDataEndTagName(code);
      case State.SCRIPT_DATA_END_TAG_NAME_MATCHED: return this.scriptDataEndTagNameMatched(code);
      case State.SCRIPT_DATA_ESCAPE_START: return this.scriptDataEscapeStart(code);
      case State.SCRIPT_DATA_ESCAPE_START_DASH: return this.scriptDataEscapeStartDash(code);
      case State.SCRIPT_DATA_ESCAPED: return this.scriptDataEscaped(code);
      case State.SCRIPT_DATA_ESCAPED_DASH: return this.scriptDataEscapedDash(code);
      case State.SCRIPT_DATA_ESCAPED_DASH_DASH: return this.scriptDataEscapedDashDash(code);
      case State.SCRIPT_DATA_ESCAPED_LESS_THAN_SIGN: return this.scriptDataEscapedLessThanSign(code);
      case State.SCRIPT_DATA_ESCAPED_END_TAG_OPEN: return this.scriptDataEscapedEndTagOpen(code);
      case State.SCRIPT_DATA_ESCAPED_END_TAG_NAME: return this.scriptDataEscapedEndTagName(code);
      case State.SCRIPT_DATA_DOUBLE_ESCAPE_START: return this.scriptDataDoubleEscapeStart(code);
      case State.SCRIPT_DATA_DOUBLE_ESCAPE_START_MATCHED: return this.scriptDataDoubleEscapeStartMatched(code);
      case State.SCRIPT_DATA_DOUBLE_ESCAPED: return this.scriptDataDoubleEscaped(code);
      case State.SCRIPT_DATA_DOUBLE_ESCAPED_DASH: return this.scriptDataDoubleEscapedDash(code);
      case State.SCRIPT_DATA_DOUBLE_ESCAPED_DASH_DASH: return this.scriptDataDoubleEscapedDashDash(code);
      case State.SCRIPT_DATA_DOUBLE_ESCAPED_LESS_THAN_SIGN: return this.scriptDataDoubleEscapedLessThanSign(code);
      case State.SCRIPT_DATA_DOUBLE_ESCAPE_END: return this.scriptDataDoubleEscapeEnd(code);
      case State.SCRIPT_DATA_DOUBLE_ESCAPE_END_MATCHED: return this.scriptDataDoubleEscapeEndMatched(code);
      case State.BEFORE_ATTRIBUTE_NAME: return this.beforeAttributeName(code);
      case State.ATTRIBUTE_NAME: return this.attributeName(code);
      case State.AFTER_ATTRIBUTE_NAME: return this.afterAttributeName(code);
      case State.BEFORE_ATTRIBUTE_VALUE: return this.beforeAttributeValue(code);
      case State.ATTRIBUTE_VALUE_DOUBLE_QUOTED: return this.attributeValueDoubleQuoted(code);
      case State.ATTRIBUTE_VALUE_SINGLE_QUOTED: return this.attributeValueSingleQuoted(code);
      case State.ATTRIBUTE_VALUE_UNQUOTED: return this.attributeValueUnquoted(code);
      case State.AFTER_ATTRIBUTE_VALUE_QUOTED: return this.afterAttributeValueQuoted(code);
      case State.SELF_CLOSING_START_TAG: return this.selfClosingStartTag(code);
      case State.BOGUS_COMMENT: return this.bogusComment(code);
      case State.MARKUP_DECLARATION_OPEN: return this.markupDeclarationOpen(code);
      case State.MARKUP_DECLARATION_FAIL: return this.markupDeclarationFail(code);
      case State.COMMENT_START: return this.commentStart(code);
      case State.COMMENT_START_DASH: return this.commentStartDash(code);
      case State.COMMENT: return this.comment(code);
      case State.COMMENT_LESS_THAN_SIGN: return this.commentLessThanSign(code);
      case State.COMMENT_LESS_THAN_SIGN_BANG: return this.commentLessThanSignBang(code);
      case State.COMMENT_LESS_THAN_SIGN_BANG_DASH: return this.commentLessThanSignBangDash(code);
      case State.COMMENT_LESS_THAN_SIGN_BANG_DASH_DASH: return this.commentLessThanSignBangDashDash(code);
      case State.COMMENT_END_DASH: return this.commentEndDash(code);
      case State.COMMENT_END: return this.commentEnd(code);
      case State.COMMENT_END_BANG: return this.commentEndBang(code);
      case State.DOCTYPE: return this.doctype(code);
      case State.BEFORE_DOCTYPE_NAME: return this.beforeDoctypeName(code);
      case State.DOCTYPE_NAME: return this.doctypeName(code);
      case State.AFTER_DOCTYPE_NAME: return this.afterDoctypeName(code);
      case State.AFTER_DOCTYPE_NAME_FAILED_SEQUENCE: return this.afterDoctypeNameFailedSequence(code);
      case State.AFTER_DOCTYPE_PUBLIC_KEYWORD: return this.afterDoctypePublicKeyword(code);
      case State.BEFORE_DOCTYPE_PUBLIC_IDENTIFIER: return this.beforeDoctypePublicIdentifier(code);
      case State.DOCTYPE_PUBLIC_IDENTIFIER_DOUBLE_QUOTED: return this.doctypePublicIdentifierDoubleQuoted(code);
      case State.DOCTYPE_PUBLIC_IDENTIFIER_SINGLE_QUOTED: return this.doctypePublicIdentifierSingleQuoted(code);
      case State.AFTER_DOCTYPE_PUBLIC_IDENTIFIER: return this.afterDoctypePublicIdentifier(code);
      case State.BETWEEN_DOCTYPE_PUBLIC_AND_SYSTEM_IDENTIFIERS: return this.betweenDoctypePublicAndSystemIdentifiers(code);
      case State.AFTER_DOCTYPE_SYSTEM_KEYWORD: return this.afterDoctypeSystemKeyword(code);
      case State.BEFORE_DOCTYPE_SYSTEM_IDENTIFIER: return this.beforeDoctypeSystemIdentifier(code);
      case State.DOCTYPE_SYSTEM_IDENTIFIER_DOUBLE_QUOTED: return this.doctypeSystemIdentifierDoubleQuoted(code);
      case State.DOCTYPE_SYSTEM_IDENTIFIER_SINGLE_QUOTED: return this.doctypeSystemIdentifierSingleQuoted(code);
      case State.AFTER_DOCTYPE_SYSTEM_IDENTIFIER: return this.afterDoctypeSystemIdentifier(code);
      case State.BOGUS_DOCTYPE: return this.bogusDoctype(code);
      case State.CDATA_SECTION_START: return this.cdataSectionStart(code);
      case State.CDATA_SECTION: return this.cdataSection(code);
      case State.CDATA_SECTION_BRACKET: return this.cdataSectionBracket(code);
      case State.CDATA_SECTION_END: return this.cdataSectionEnd(code);
      case State.CHARACTER_REFERENCE: return this.characterReference(code);
      case State.NAMED_CHARACTER_REFERENCE: return this.namedCharacterReference(code);
      case State.AMBIGUOUS_AMPERSAND: return this.ambiguousAmpersand(code);
      case State.NUMERIC_CHARACTER_REFERENCE: return this.numericCharacterReference(code);
      case State.HEXADECIMAL_CHARACTER_REFERENCE_START: return this.hexadecimalCharacterReferenceStart(code);
      case State.DECIMAL_CHARACTER_REFERENCE_START: return this.decimalCharacterReferenceStart(code);
      case State.HEXADECIMAL_CHARACTER_REFERENCE: return this.hexadecimalCharacterReference(code);
      case State.DECIMAL_CHARACTER_REFERENCE: return this.decimalCharacterReference(code);
      case State.SEQUENCE_CASE_SENSITIVE: return this.sequenceCaseSensitive(code);
      case State.SEQUENCE_CASE_INSENSITIVE: return this.sequenceCaseInsensitive(code);
// @formatter:on
    }
  }

  // TODO inline this for static transitions
  callState(state: State, code: number): State {
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

  eofInDoctype(): State {
    this.currentDoctype.forceQuirks = true;
    this.error('eof-in-doctype');
    this.emitCurrentDoctype();
    return this.eof();
  }

  eof(): State {
    this.emit(EOF_TOKEN);
    this.active = false;
    return State.EOF;
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
  matchSequence(code: number, seq: readonly number[], caseInsensitive: boolean, positiveState: State, negativeState: State): State {
    this.sequenceBufferOffset = this.buffer.position;
    this.sequenceData = seq;
    this.sequenceIndex = 0;
    this.sequencePositiveState = positiveState;
    this.sequenceNegativeState = negativeState;
    if (caseInsensitive) {
      this.state = State.SEQUENCE_CASE_INSENSITIVE;
      return this.sequenceCaseInsensitive(code);
    } else {
      this.state = State.SEQUENCE_CASE_SENSITIVE;
      return this.sequenceCaseSensitive(code);
    }
  }

  sequenceCaseSensitive(code: number): State {
    const seqData = this.sequenceData;
    const buffer = this.buffer;
    const len = this.sequenceData.length;
    while (this.sequenceIndex < len) {
      if (code === CodePoints.EOC) return State.SEQUENCE_CASE_SENSITIVE;
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

  sequenceCaseInsensitive(code: number): State {
    const seqData = this.sequenceData;
    const buffer = this.buffer;
    const len = this.sequenceData.length;
    while (this.sequenceIndex < len) {
      if (code === CodePoints.EOC) return State.SEQUENCE_CASE_INSENSITIVE;
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
  textDataNoRefs(code: number, ltState: State, thisState: State): State {
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

  textDataLessThanSign(code: number, endTagOpenState: State, textState: State, thisState: State): State {
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

  textDataEndTagOpen(code: number, tagNameState: State, textState: State): State {
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

  textDataEndTagMatched(code: number, textState: State): State {
    switch (code) {
      case CodePoints.TAB:
      case CodePoints.LF:
      case CodePoints.FF:
      case CodePoints.SPACE:
        this.createTextDataEndTag(this.lastOpenTag!);
        return State.BEFORE_ATTRIBUTE_NAME;
      case CodePoints.SLASH:
        this.createTextDataEndTag(this.lastOpenTag!);
        return State.SELF_CLOSING_START_TAG;
      case CodePoints.GT:
        this.createTextDataEndTag(this.lastOpenTag!);
        this.emitCurrentTag();
        return State.DATA;
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

  data(code: number): State {
    while (true) {
      switch (code) {
        case CodePoints.EOC:
          this.paused = true;
          return State.DATA;
        case CodePoints.AMPERSAND:
          this.returnState = this.state;
          this.inAttribute = false;
          return State.CHARACTER_REFERENCE;
        case CodePoints.LT:
          return State.TAG_OPEN;
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

  plaintext(code: number): State {
    while (true) {
      switch (code) {
        case CodePoints.EOC:
          this.paused = true;
          return State.PLAINTEXT;
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
    const buffer = this.buffer;
    switch (code) {
      case CodePoints.EXCLAMATION:
        return State.MARKUP_DECLARATION_OPEN;
      case CodePoints.SLASH:
        this.startNewTag();
        return State.END_TAG_OPEN;
      case CodePoints.QUESTION:
        this.emitAccumulatedCharacters();
        this.error('unexpected-question-mark-instead-of-tag-name');
        this.startNewComment();
        return this.callState(State.BOGUS_COMMENT, code);
      case CodePoints.EOF:
        this.appendCharacter(CodePoints.LT);
        this.emitAccumulatedCharacters();
        this.error('eof-before-tag-name');
        return this.eof();
      default:
        if (isAsciiAlpha(code)) {
          this.emitAccumulatedCharacters();
          this.startNewTag();
          return this.callState(State.TAG_NAME, code);
        }
        this.error('invalid-first-character-of-tag-name');
        buffer.append(CodePoints.LT);
        return this.callState(State.DATA, code);
    }
  }

  endTagOpen(code: number): State {
    switch (code) {
      case CodePoints.GT:
        this.error('missing-end-tag-name');
        return State.DATA;
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
          return this.callState(State.TAG_NAME, code);
        }
        this.emitAccumulatedCharacters();
        this.error('invalid-first-character-of-tag-name');
        this.startNewComment();
        return this.callState(State.BOGUS_COMMENT, code);
    }
  }

  tagName(code: number): State {
    const buffer = this.buffer;
    while (true) {
      switch (code) {
        case CodePoints.EOC:
          this.paused = true;
          return State.TAG_NAME;
        case CodePoints.TAB:
        case CodePoints.LF:
        case CodePoints.FF:
        case CodePoints.SPACE:
          this.currentTag.name = buffer.takeString();
          return State.BEFORE_ATTRIBUTE_NAME;
        case CodePoints.SLASH:
          this.currentTag.name = buffer.takeString();
          return State.SELF_CLOSING_START_TAG;
        case CodePoints.GT:
          this.currentTag.name = buffer.takeString();
          this.emitCurrentTag();
          return State.DATA;
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
        case CodePoints.EOC:
          this.paused = true;
          return State.BEFORE_ATTRIBUTE_NAME;
        case CodePoints.TAB:
        case CodePoints.LF:
        case CodePoints.FF:
        case CodePoints.SPACE:
          code = this.nextCode();
          break;
        case CodePoints.SLASH:
        case CodePoints.GT:
        case CodePoints.EOF:
          return this.callState(State.AFTER_ATTRIBUTE_NAME, code);
        case CodePoints.EQ:
          this.error('unexpected-equals-sign-before-attribute-name');
          this.startNewAttribute();
          this.buffer.append(code);
          return State.ATTRIBUTE_NAME;
        default:
          this.startNewAttribute();
          return this.callState(State.ATTRIBUTE_NAME, code);
      }
    }
  }

  attributeName(code: number): State {
    const buffer = this.buffer;
    while (true) {
      switch (code) {
        case CodePoints.EOC:
          this.paused = true;
          return State.ATTRIBUTE_NAME;
        case CodePoints.EQ:
          this.checkDuplicateAttribute(this.currentAttribute.name = buffer.takeString());
          return State.BEFORE_ATTRIBUTE_VALUE;
        case CodePoints.TAB:
        case CodePoints.LF:
        case CodePoints.FF:
        case CodePoints.SPACE:
        case CodePoints.GT:
        case CodePoints.SLASH:
        case CodePoints.EOF:
          this.checkDuplicateAttribute(this.currentAttribute.name = buffer.takeString());
          return this.callState(State.AFTER_ATTRIBUTE_NAME, code);
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

  afterAttributeName(code: number): State {
    while (true) {
      switch (code) {
        case CodePoints.EOC:
          this.paused = true;
          return State.AFTER_ATTRIBUTE_NAME;
        case CodePoints.EQ:
          return State.BEFORE_ATTRIBUTE_VALUE;
        case CodePoints.TAB:
        case CodePoints.LF:
        case CodePoints.FF:
        case CodePoints.SPACE:
          code = this.nextCode();
          break;
        case CodePoints.GT:
          this.emitCurrentTag();
          return State.DATA;
        case CodePoints.SLASH:
          return State.SELF_CLOSING_START_TAG;
        case CodePoints.EOF:
          this.error('eof-in-tag');
          return this.eof();
        default:
          this.startNewAttribute();
          return this.callState(State.ATTRIBUTE_NAME, code);
      }
    }
  }

  beforeAttributeValue(code: number): State {
    while (true) {
      switch (code) {
        case CodePoints.EOC:
          this.paused = true;
          return State.BEFORE_ATTRIBUTE_VALUE;
        case CodePoints.TAB:
        case CodePoints.LF:
        case CodePoints.FF:
        case CodePoints.SPACE:
          code = this.nextCode();
          break;
        case CodePoints.DOUBLE_QUOTE:
          return State.ATTRIBUTE_VALUE_DOUBLE_QUOTED;
        case CodePoints.SINGLE_QUOTE:
          return State.ATTRIBUTE_VALUE_SINGLE_QUOTED;
        case CodePoints.GT:
          this.error('missing-attribute-value');
          this.emitCurrentTag();
          return State.DATA;
        default:
          return this.callState(State.ATTRIBUTE_VALUE_UNQUOTED, code);
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
    const buffer = this.buffer;
    while (true) {
      switch (code) {
        case CodePoints.EOC:
          this.paused = true;
          return terminator === CodePoints.DOUBLE_QUOTE ? State.ATTRIBUTE_VALUE_DOUBLE_QUOTED : State.ATTRIBUTE_VALUE_SINGLE_QUOTED;
        case terminator:
          this.currentAttribute.value = buffer.takeString();
          return State.AFTER_ATTRIBUTE_VALUE_QUOTED;
        case CodePoints.AMPERSAND:
          this.returnState = this.state;
          this.inAttribute = true;
          return State.CHARACTER_REFERENCE;
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
    const buffer = this.buffer;
    while (true) {
      switch (code) {
        case CodePoints.EOC:
          this.paused = true;
          return State.ATTRIBUTE_VALUE_UNQUOTED;
        case CodePoints.TAB:
        case CodePoints.LF:
        case CodePoints.FF:
        case CodePoints.SPACE:
          this.currentAttribute.value = buffer.takeString();
          return State.BEFORE_ATTRIBUTE_NAME;
        case CodePoints.AMPERSAND:
          this.returnState = this.state;
          this.inAttribute = true;
          return State.CHARACTER_REFERENCE;
        case CodePoints.GT:
          this.currentAttribute.value = buffer.takeString();
          this.emitCurrentTag();
          return State.DATA;
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
        return State.BEFORE_ATTRIBUTE_NAME;
      case CodePoints.SLASH:
        return State.SELF_CLOSING_START_TAG;
      case CodePoints.GT:
        this.emitCurrentTag();
        return State.DATA;
      case CodePoints.EOF:
        this.error('eof-in-tag');
        return this.eof();
      default:
        this.error('missing-whitespace-between-attributes');
        return this.callState(State.BEFORE_ATTRIBUTE_NAME, code);
    }
  }

  selfClosingStartTag(code: number): State {
    switch (code) {
      case CodePoints.GT:
        this.currentTag.selfClosed = true;
        this.emitCurrentTag();
        return State.DATA;
      case CodePoints.EOF:
        this.error('eof-in-tag');
        return this.eof();
      default:
        this.error('unexpected-solidus-in-tag');
        return this.callState(State.BEFORE_ATTRIBUTE_NAME, code);
    }
  }

  // -----CDATA states-----
  cdataSectionStart(code: number): State {
    const adjustedNode = this.composer.adjustedCurrentNode;
    if (adjustedNode && adjustedNode.namespaceURI !== NS_HTML) {
      this.buffer.position = this.sequenceBufferOffset;
      return this.callState(State.CDATA_SECTION, code);
    }
    this.startNewComment();
    this.error('cdata-in-html-content');
    return this.bogusComment(code);
  }

  cdataSection(code: number): State {
    while (true) {
      switch (code) {
        case CodePoints.EOC:
          this.paused = true;
          return State.CDATA_SECTION;
        case CodePoints.CLOSE_SQUARE_BRACKET:
          return State.CDATA_SECTION_BRACKET;
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
      return State.CDATA_SECTION_END;
    else {
      this.appendNonWhitespace(CodePoints.CLOSE_SQUARE_BRACKET);
      return this.callState(State.CDATA_SECTION, code);
    }
  }

  cdataSectionEnd(code: number): State {
    while (true) {
      switch (code) {
        case CodePoints.EOC:
          this.paused = true;
          return State.CDATA_SECTION_END;
        case CodePoints.CLOSE_SQUARE_BRACKET:
          this.appendNonWhitespace(CodePoints.CLOSE_SQUARE_BRACKET);
          code = this.nextCode();
          break;
        case CodePoints.GT:
          this.emitCData();
          return State.DATA;
        default:
          this.appendNonWhitespace(CodePoints.CLOSE_SQUARE_BRACKET);
          this.appendNonWhitespace(CodePoints.CLOSE_SQUARE_BRACKET);
          return this.callState(State.CDATA_SECTION, code);
      }
    }
  }

  // -----character reference states-----
  characterReference(code: number): State {
    const buffer = this.buffer;
    this.referenceStartMark = buffer.position;
    if (this.inAttribute) buffer.append(CodePoints.AMPERSAND);
    else  // TODO this should be handled with respect to current whitespace mode
      this.appendNonWhitespace(CodePoints.AMPERSAND);
    if (code === CodePoints.SHARP) {
      if (this.inAttribute) buffer.append(CodePoints.SHARP);
      else this.appendNonWhitespace(CodePoints.SHARP);
      return State.NUMERIC_CHARACTER_REFERENCE;
    } else if (isAsciiAlphaNum(code)) {
      this.lastRefNode = this.refsIndex;
      this.lastMatch = 0;
      return this.callState(State.NAMED_CHARACTER_REFERENCE, code);
    } else
      return this.callState(this.returnState, code);
  }

  numericCharacterReference(code: number): State {
    this.charCode = 0;
    if (code === CodePoints.X_CAPITAL || code === CodePoints.X_REGULAR) {
      if (this.inAttribute) this.buffer.append(code);
      else this.appendNonWhitespace(code);
      return State.HEXADECIMAL_CHARACTER_REFERENCE_START;
    } else
      return this.callState(State.DECIMAL_CHARACTER_REFERENCE_START, code);
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

  namedCharacterReference(code: number): State {
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
        return State.NAMED_CHARACTER_REFERENCE;
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
      return this.callState(State.AMBIGUOUS_AMPERSAND, code);
  }

  hexadecimalCharacterReferenceStart(code: number): State {
    if (!isHexDigit(code)) {
      this.error('absence-of-digits-in-numeric-character-reference');
      return this.callState(this.returnState, code);
    } else
      return this.callState(State.HEXADECIMAL_CHARACTER_REFERENCE, code);
  }

  hexadecimalCharacterReference(code: number): State {
    while (true) {
      if (code === CodePoints.EOC) {
        this.paused = true;
        return State.HEXADECIMAL_CHARACTER_REFERENCE;
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

  decimalCharacterReferenceStart(code: number): State {
    if (!isDigit(code)) {
      this.error('absence-of-digits-in-numeric-character-reference');
      return this.callState(this.returnState, code);
    } else
      return this.callState(State.DECIMAL_CHARACTER_REFERENCE, code);
  }

  decimalCharacterReference(code: number): State {
    while (true) {
      switch (code) {
        case CodePoints.EOC:
          this.paused = true;
          return State.DECIMAL_CHARACTER_REFERENCE;
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

  ambiguousAmpersand(code: number): State {
    const buffer = this.buffer;
    while (true) {
      switch (code) {
        case CodePoints.EOC:
          this.paused = true;
          return State.AMBIGUOUS_AMPERSAND;
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
  commentStart(code: number): State {
    this.buffer.position = this.sequenceBufferOffset;
    this.startNewComment();
    switch (code) {
      case CodePoints.HYPHEN:
        return State.COMMENT_START_DASH;
      case CodePoints.GT:
        this.error('abrupt-closing-of-empty-comment');
        this.emitCurrentComment();
        return State.DATA;
      default:
        return this.callState(State.COMMENT, code);
    }
  }

  commentStartDash(code: number): State {
    switch (code) {
      case CodePoints.HYPHEN:
        return State.COMMENT_END;
      case CodePoints.GT:
        this.error('abrupt-closing-of-empty-comment');
        this.emitCurrentComment();
        return State.DATA;
      case CodePoints.EOF:
        this.error('eof-in-comment');
        this.emitCurrentComment();
        return this.eof();
      default:
        this.buffer.append(CodePoints.HYPHEN);
        return this.callState(State.COMMENT, code);
    }
  }

  comment(code: number): State {
    const buffer = this.buffer;
    while (true) {
      switch (code) {
        case CodePoints.EOC:
          this.paused = true;
          return State.COMMENT;
        case CodePoints.LT:
          buffer.append(code);
          return State.COMMENT_LESS_THAN_SIGN;
        case CodePoints.HYPHEN:
          return State.COMMENT_END_DASH;
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
    const buffer = this.buffer;
    while (true) {
      switch (code) {
        case CodePoints.EOC:
          this.paused = true;
          return State.COMMENT_LESS_THAN_SIGN;
        case CodePoints.EXCLAMATION:
          buffer.append(code);
          return State.COMMENT_LESS_THAN_SIGN_BANG;
        case CodePoints.LT:
          buffer.append(code);
          code = this.nextCode();
          break;
        default:
          return this.callState(State.COMMENT, code);
      }
    }
  }

  commentLessThanSignBang(code: number): State {
    if (code === CodePoints.HYPHEN)
      return State.COMMENT_LESS_THAN_SIGN_BANG_DASH;
    else
      return this.callState(State.COMMENT, code);
  }

  commentLessThanSignBangDash(code: number): State {
    if (code === CodePoints.HYPHEN)
      return State.COMMENT_LESS_THAN_SIGN_BANG_DASH_DASH;
    else
      return this.callState(State.COMMENT_END_DASH, code);
  }

  commentLessThanSignBangDashDash(code: number): State {
    if (code !== CodePoints.GT && code !== CodePoints.EOF)
      this.error('nested-comment');
    return this.callState(State.COMMENT_END, code);
  }

  commentEndDash(code: number): State {
    switch (code) {
      case CodePoints.HYPHEN:
        return State.COMMENT_END;
      case CodePoints.EOF:
        // by the spec extra dash is NOT appended here
        // so unfinished comments ending with single dash do NOT include that dash in data
        this.error('eof-in-comment');
        this.emitCurrentComment();
        return this.eof();
      default:
        this.buffer.append(CodePoints.HYPHEN);
        return this.callState(State.COMMENT, code);
    }
  }

  commentEnd(code: number): State {
    const buffer = this.buffer;
    while (true) {
      switch (code) {
        case CodePoints.EOC:
          this.paused = true;
          return State.COMMENT_END;
        case CodePoints.GT:
          this.emitCurrentComment();
          return State.DATA;
        case CodePoints.EXCLAMATION:
          return State.COMMENT_END_BANG;
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
          return this.callState(State.COMMENT, code);
      }
    }
  }

  commentEndBang(code: number): State {
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
        return State.COMMENT_END_DASH;
      case CodePoints.GT:
        this.error('incorrectly-closed-comment');
        this.emitCurrentComment();
        return State.DATA;
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
        return this.callState(State.COMMENT, code);
    }
  }

  bogusComment(code: number): State {
    const buffer = this.buffer;
    while (true) {
      switch (code) {
        case CodePoints.EOC:
          this.paused = true;
          return State.BOGUS_COMMENT;
        case CodePoints.GT:
          this.emitCurrentComment();
          return State.DATA;
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
        return this.matchSequence(code, TWO_HYPHENS, false, State.COMMENT_START, State.MARKUP_DECLARATION_FAIL);
      case 0x44: // D
      case 0x64: // d
        return this.matchSequence(code, DOCTYPE, true, State.DOCTYPE, State.MARKUP_DECLARATION_FAIL);
      case CodePoints.OPEN_SQUARE_BRACKET:
        return this.matchSequence(code, CDATA, false, State.CDATA_SECTION_START, State.MARKUP_DECLARATION_FAIL);
      default:
        return this.callState(State.MARKUP_DECLARATION_FAIL, code);
    }
  }

  markupDeclarationFail(code: number): State {
    this.startNewComment();
    this.error('incorrectly-opened-comment');
    return this.callState(State.BOGUS_COMMENT, code);
  }

  // -----doctype states-----
  doctype(code: number): State {
    this.buffer.position = this.sequenceBufferOffset;
    this.emitAccumulatedCharacters();
    this.startNewDoctype();
    switch (code) {
      case CodePoints.TAB:
      case CodePoints.LF:
      case CodePoints.FF:
      case CodePoints.SPACE:
        return State.BEFORE_DOCTYPE_NAME;
      case CodePoints.EOF:
        return this.eofInDoctype();
      default:
        this.error('missing-whitespace-before-doctype-name');
      case CodePoints.GT:
        return this.callState(State.BEFORE_DOCTYPE_NAME, code);
    }
  }

  beforeDoctypeName(code: number): State {
    const buffer = this.buffer;
    while (true) {
      switch (code) {
        case CodePoints.EOC:
          this.paused = true;
          return State.BEFORE_DOCTYPE_NAME;
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
          return State.DATA;
        case CodePoints.EOF:
          return this.eofInDoctype();
        case CodePoints.NUL:
          this.error('unexpected-null-character');
          code = CodePoints.REPLACEMENT_CHAR;
        default:
          if (isAsciiUpperAlpha(code)) code += 0x20;
          buffer.append(code);
          return State.DOCTYPE_NAME;
      }
    }
  }

  doctypeName(code: number): State {
    const buffer = this.buffer;
    while (true) {
      switch (code) {
        case CodePoints.EOC:
          this.paused = true;
          return State.DOCTYPE_NAME;
        case CodePoints.TAB:
        case CodePoints.LF:
        case CodePoints.FF:
        case CodePoints.SPACE:
          this.currentDoctype.name = buffer.takeString();
          return State.AFTER_DOCTYPE_NAME;
        case CodePoints.GT:
          this.currentDoctype.name = buffer.takeString();
          this.emitCurrentDoctype();
          return State.DATA;
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
        case CodePoints.EOC:
          this.paused = true;
          return State.AFTER_DOCTYPE_NAME;
        case CodePoints.TAB:
        case CodePoints.LF:
        case CodePoints.FF:
        case CodePoints.SPACE:
          code = this.nextCode();
          break;
        case CodePoints.GT:
          this.emitCurrentDoctype();
          return State.DATA;
        case CodePoints.EOF:
          return this.eofInDoctype();
        case 0x50: // P
        case 0x70: // p
          return this.matchSequence(code, PUBLIC, true, State.AFTER_DOCTYPE_PUBLIC_KEYWORD, State.AFTER_DOCTYPE_NAME_FAILED_SEQUENCE);
        case 0x53: // S
        case 0x73: // s
          return this.matchSequence(code, SYSTEM, true, State.AFTER_DOCTYPE_SYSTEM_KEYWORD, State.AFTER_DOCTYPE_NAME_FAILED_SEQUENCE);
        default:
          return this.callState(State.AFTER_DOCTYPE_NAME_FAILED_SEQUENCE, code);
      }
    }
  }

  afterDoctypeNameFailedSequence(code: number): State {
    this.buffer.position = this.sequenceBufferOffset;
    this.currentDoctype.forceQuirks = true;
    this.error('invalid-character-sequence-after-doctype-name');
    return this.callState(State.BOGUS_DOCTYPE, code);
  }

  afterDoctypePublicKeyword(code: number): State {
    this.buffer.position = this.sequenceBufferOffset;
    switch (code) {
      case CodePoints.TAB:
      case CodePoints.LF:
      case CodePoints.FF:
      case CodePoints.SPACE:
        return State.BEFORE_DOCTYPE_PUBLIC_IDENTIFIER;
      case CodePoints.DOUBLE_QUOTE:
        this.error('missing-whitespace-after-doctype-public-keyword');
        return State.DOCTYPE_PUBLIC_IDENTIFIER_DOUBLE_QUOTED;
      case CodePoints.SINGLE_QUOTE:
        this.error('missing-whitespace-after-doctype-public-keyword');
        return State.DOCTYPE_PUBLIC_IDENTIFIER_SINGLE_QUOTED;
      case CodePoints.GT:
        this.currentDoctype.forceQuirks = true;
        this.error('missing-doctype-public-identifier');
        this.emitCurrentDoctype();
        return State.DATA;
      case CodePoints.EOF:
        return this.eofInDoctype();
      default:
        this.currentDoctype.forceQuirks = true;
        this.error('missing-quote-before-doctype-public-identifier');
        return this.callState(State.BOGUS_DOCTYPE, code);
    }
  }

  beforeDoctypePublicIdentifier(code: number): State {
    while (true) {
      switch (code) {
        case CodePoints.EOC:
          this.paused = true;
          return State.BEFORE_DOCTYPE_PUBLIC_IDENTIFIER;
        case CodePoints.TAB:
        case CodePoints.LF:
        case CodePoints.FF:
        case CodePoints.SPACE:
          code = this.nextCode();
          break;
        case CodePoints.DOUBLE_QUOTE:
          return State.DOCTYPE_PUBLIC_IDENTIFIER_DOUBLE_QUOTED;
        case CodePoints.SINGLE_QUOTE:
          return State.DOCTYPE_PUBLIC_IDENTIFIER_SINGLE_QUOTED;
        case CodePoints.GT:
          this.currentDoctype.forceQuirks = true;
          this.error('missing-doctype-public-identifier');
          this.emitCurrentDoctype();
          return State.DATA;
        case CodePoints.EOF:
          return this.eofInDoctype();
        default:
          this.currentDoctype.forceQuirks = true;
          this.error('missing-quote-before-doctype-public-identifier');
          return this.callState(State.BOGUS_DOCTYPE, code);
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
    const buffer = this.buffer;
    while (true) {
      switch (code) {
        case CodePoints.EOC:
          this.paused = true;
          return terminator === CodePoints.DOUBLE_QUOTE ? State.DOCTYPE_PUBLIC_IDENTIFIER_DOUBLE_QUOTED : State.DOCTYPE_PUBLIC_IDENTIFIER_SINGLE_QUOTED;
        case terminator:
          this.currentDoctype.publicId = buffer.takeString();
          return State.AFTER_DOCTYPE_PUBLIC_IDENTIFIER;
        case CodePoints.GT:
          this.currentDoctype.publicId = buffer.takeString();
          this.currentDoctype.forceQuirks = true;
          this.error('abrupt-doctype-public-identifier');
          this.emitCurrentDoctype();
          return State.DATA;
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
        return State.BETWEEN_DOCTYPE_PUBLIC_AND_SYSTEM_IDENTIFIERS;
      case CodePoints.GT:
        this.emitCurrentDoctype();
        return State.DATA;
      case CodePoints.DOUBLE_QUOTE:
        this.error('missing-whitespace-between-doctype-public-and-system-identifiers');
        return State.DOCTYPE_SYSTEM_IDENTIFIER_DOUBLE_QUOTED;
      case CodePoints.SINGLE_QUOTE:
        this.error('missing-whitespace-between-doctype-public-and-system-identifiers');
        return State.DOCTYPE_SYSTEM_IDENTIFIER_SINGLE_QUOTED;
      case CodePoints.EOF:
        return this.eofInDoctype();
      default:
        this.currentDoctype.forceQuirks = true;
        this.error('missing-quote-before-doctype-system-identifier');
        return this.callState(State.BOGUS_DOCTYPE, code);
    }
  }

  betweenDoctypePublicAndSystemIdentifiers(code: number): State {
    while (true) {
      switch (code) {
        case CodePoints.EOC:
          this.paused = true;
          return State.BETWEEN_DOCTYPE_PUBLIC_AND_SYSTEM_IDENTIFIERS;
        case CodePoints.TAB:
        case CodePoints.LF:
        case CodePoints.FF:
        case CodePoints.SPACE:
          code = this.nextCode();
          break;
        case CodePoints.DOUBLE_QUOTE:
          return State.DOCTYPE_SYSTEM_IDENTIFIER_DOUBLE_QUOTED;
        case CodePoints.SINGLE_QUOTE:
          return State.DOCTYPE_SYSTEM_IDENTIFIER_SINGLE_QUOTED;
        case CodePoints.GT:
          this.emitCurrentDoctype();
          return State.DATA;
        case CodePoints.EOF:
          return this.eofInDoctype();
        default:
          this.currentDoctype.forceQuirks = true;
          this.error('missing-quote-before-doctype-system-identifier');
          return this.callState(State.BOGUS_DOCTYPE, code);
      }
    }
  }

  afterDoctypeSystemKeyword(code: number): State {
    this.buffer.position = this.sequenceBufferOffset;
    switch (code) {
      case CodePoints.TAB:
      case CodePoints.LF:
      case CodePoints.FF:
      case CodePoints.SPACE:
        return State.BEFORE_DOCTYPE_SYSTEM_IDENTIFIER;
      case CodePoints.DOUBLE_QUOTE:
        this.error('missing-whitespace-after-doctype-system-keyword');
        return State.DOCTYPE_SYSTEM_IDENTIFIER_DOUBLE_QUOTED;
      case CodePoints.SINGLE_QUOTE:
        this.error('missing-whitespace-after-doctype-system-keyword');
        return State.DOCTYPE_SYSTEM_IDENTIFIER_SINGLE_QUOTED;
      case CodePoints.GT:
        this.currentDoctype.forceQuirks = true;
        this.error('missing-doctype-system-identifier');
        this.emitCurrentDoctype();
        return State.DATA;
      case CodePoints.EOF:
        return this.eofInDoctype();
      default:
        this.currentDoctype.forceQuirks = true;
        this.error('missing-quote-before-doctype-system-identifier');
        return this.callState(State.BOGUS_DOCTYPE, code);
    }
  }

  beforeDoctypeSystemIdentifier(code: number): State {
    while (true) {
      switch (code) {
        case CodePoints.EOC:
          this.paused = true;
          return State.BEFORE_DOCTYPE_SYSTEM_IDENTIFIER;
        case CodePoints.TAB:
        case CodePoints.LF:
        case CodePoints.FF:
        case CodePoints.SPACE:
          code = this.nextCode();
          break;
        case CodePoints.DOUBLE_QUOTE:
          return State.DOCTYPE_SYSTEM_IDENTIFIER_DOUBLE_QUOTED;
        case CodePoints.SINGLE_QUOTE:
          return State.DOCTYPE_SYSTEM_IDENTIFIER_SINGLE_QUOTED;
        case CodePoints.GT:
          this.currentDoctype.forceQuirks = true;
          this.error('missing-doctype-system-identifier');
          this.emitCurrentDoctype();
          return State.DATA;
        case CodePoints.EOF:
          return this.eofInDoctype();
        default:
          this.currentDoctype.forceQuirks = true;
          this.error('missing-quote-before-doctype-system-identifier');
          return this.callState(State.BOGUS_DOCTYPE, code);
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
    const buffer = this.buffer;
    while (true) {
      switch (code) {
        case CodePoints.EOC:
          this.paused = true;
          return terminator === CodePoints.DOUBLE_QUOTE ? State.DOCTYPE_SYSTEM_IDENTIFIER_DOUBLE_QUOTED : State.DOCTYPE_SYSTEM_IDENTIFIER_SINGLE_QUOTED;
        case terminator:
          this.currentDoctype.systemId = buffer.takeString();
          return State.AFTER_DOCTYPE_SYSTEM_IDENTIFIER;
        case CodePoints.GT:
          this.currentDoctype.systemId = buffer.takeString();
          this.currentDoctype.forceQuirks = true;
          this.error('abrupt-doctype-system-identifier');
          this.emitCurrentDoctype();
          return State.DATA;
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
        case CodePoints.EOC:
          this.paused = true;
          return State.AFTER_DOCTYPE_SYSTEM_IDENTIFIER;
        case CodePoints.TAB:
        case CodePoints.LF:
        case CodePoints.FF:
        case CodePoints.SPACE:
          code = this.nextCode();
          break;
        case CodePoints.GT:
          this.emitCurrentDoctype();
          return State.DATA;
        case CodePoints.EOF:
          return this.eofInDoctype();
        default:
          this.error('unexpected-character-after-doctype-system-identifier');
          return this.callState(State.BOGUS_DOCTYPE, code);
      }
    }
  }

  bogusDoctype(code: number): State {
    while (true) {
      switch (code) {
        case CodePoints.EOC:
          this.paused = true;
          return State.BOGUS_DOCTYPE;
        case CodePoints.GT:
          this.emitCurrentDoctype()
          return State.DATA;
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
    return this.textDataNoRefs(code, State.SCRIPT_DATA_LESS_THAN_SIGN, State.SCRIPT_DATA);
  }

  scriptDataLessThanSign(code: number): State {
    switch (code) {
      case CodePoints.SLASH:
        return State.SCRIPT_DATA_END_TAG_OPEN;
      case CodePoints.EXCLAMATION:
        this.appendNonWhitespace(CodePoints.LT);
        this.appendNonWhitespace(CodePoints.EXCLAMATION);
        return State.SCRIPT_DATA_ESCAPE_START;
      default:
        this.appendNonWhitespace(CodePoints.LT);
        return this.callState(State.SCRIPT_DATA, code);
    }
  }

  scriptDataEndTagOpen(code: number): State {
    return this.textDataEndTagOpen(code, State.SCRIPT_DATA_END_TAG_NAME, State.SCRIPT_DATA);
  }

  scriptDataEndTagName(code: number): State {
    return this.matchSequence(code, SCRIPT, true, State.SCRIPT_DATA_END_TAG_NAME_MATCHED, State.SCRIPT_DATA);
  }

  scriptDataEndTagNameMatched(code: number): State {
    return this.textDataEndTagMatched(code, State.SCRIPT_DATA);
  }

  scriptDataEscapeStart(code: number): State {
    if (code === CodePoints.HYPHEN) {
      this.appendNonWhitespace(code);
      return State.SCRIPT_DATA_ESCAPE_START_DASH;
    } else
      return this.callState(State.SCRIPT_DATA, code);
  }

  scriptDataEscapeStartDash(code: number): State {
    if (code === CodePoints.HYPHEN) {
      this.appendNonWhitespace(code);
      return State.SCRIPT_DATA_ESCAPED_DASH_DASH;
    } else
      return this.callState(State.SCRIPT_DATA, code);
  }

  scriptDataEscaped(code: number): State {
    while (true) {
      switch (code) {
        case CodePoints.EOC:
          this.paused = true;
          return State.SCRIPT_DATA_ESCAPED;
        case CodePoints.HYPHEN:
          this.appendNonWhitespace(code);
          return State.SCRIPT_DATA_ESCAPED_DASH;
        case CodePoints.LT:
          return State.SCRIPT_DATA_ESCAPED_LESS_THAN_SIGN;
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
        return State.SCRIPT_DATA_ESCAPED_DASH_DASH;
      case CodePoints.LT:
        return State.SCRIPT_DATA_ESCAPED_LESS_THAN_SIGN;
      case CodePoints.EOF:
        this.error('eof-in-script-html-comment-like-text');
        this.emitAccumulatedCharacters();
        return this.eof();
      case CodePoints.NUL:
        this.error('unexpected-null-character');
        code = CodePoints.REPLACEMENT_CHAR;
      default:
        this.appendCharacter(code);
        return State.SCRIPT_DATA_ESCAPED;
    }
  }

  scriptDataEscapedDashDash(code: number): State {
    while (true) {
      switch (code) {
        case CodePoints.EOC:
          this.paused = true;
          return State.SCRIPT_DATA_ESCAPED_DASH_DASH;
        case CodePoints.HYPHEN:
          this.appendNonWhitespace(code);
          code = this.nextCode();
          break;
        case CodePoints.LT:
          return State.SCRIPT_DATA_ESCAPED_LESS_THAN_SIGN;
        case CodePoints.GT:
          this.appendNonWhitespace(code);
          return State.SCRIPT_DATA;
        case CodePoints.EOF:
          this.error('eof-in-script-html-comment-like-text');
          this.emitAccumulatedCharacters();
          return this.eof();
        case CodePoints.NUL:
          this.error('unexpected-null-character');
          code = CodePoints.REPLACEMENT_CHAR;
        default:
          this.appendCharacter(code);
          return State.SCRIPT_DATA_ESCAPED;
      }
    }
  }

  scriptDataEscapedLessThanSign(code: number): State {
    if (code === CodePoints.SLASH) {
      return State.SCRIPT_DATA_ESCAPED_END_TAG_OPEN;
    } else if (isAsciiAlpha(code)) {
      this.appendNonWhitespace(CodePoints.LT);
      return this.scriptDataDoubleEscapeStart(code);
    } else {
      this.appendNonWhitespace(CodePoints.LT);
      return this.callState(State.SCRIPT_DATA_ESCAPED, code);
    }
  }

  scriptDataEscapedEndTagOpen(code: number): State {
    return this.textDataEndTagOpen(code, State.SCRIPT_DATA_ESCAPED_END_TAG_NAME, State.SCRIPT_DATA_ESCAPED);
  }

  scriptDataEscapedEndTagName(code: number): State {
    return this.matchSequence(code, SCRIPT, true, State.SCRIPT_DATA_END_TAG_NAME_MATCHED, State.SCRIPT_DATA_ESCAPED);
  }

  scriptDataDoubleEscapeStart(code: number): State {
    return this.matchSequence(code, SCRIPT, true, State.SCRIPT_DATA_DOUBLE_ESCAPE_START_MATCHED, State.SCRIPT_DATA_ESCAPED);
  }

  scriptDataDoubleEscapeStartMatched(code: number): State {
    switch (code) {
      case CodePoints.TAB:
      case CodePoints.LF:
      case CodePoints.FF:
      case CodePoints.SPACE:
        this.appendWhitespace(code);
        return State.SCRIPT_DATA_DOUBLE_ESCAPED;
      case CodePoints.SLASH:
      case CodePoints.GT:
        this.appendNonWhitespace(code);
        return State.SCRIPT_DATA_DOUBLE_ESCAPED;
      default:
        return this.callState(State.SCRIPT_DATA_ESCAPED, code);
    }
  }

  scriptDataDoubleEscaped(code: number): State {
    while (true) {
      switch (code) {
        case CodePoints.EOC:
          this.paused = true;
          return State.SCRIPT_DATA_DOUBLE_ESCAPED;
        case CodePoints.HYPHEN:
          this.appendNonWhitespace(code);
          return State.SCRIPT_DATA_DOUBLE_ESCAPED_DASH;
        case CodePoints.LT:
          this.appendNonWhitespace(code);
          return State.SCRIPT_DATA_DOUBLE_ESCAPED_LESS_THAN_SIGN;
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
        return State.SCRIPT_DATA_DOUBLE_ESCAPED_DASH_DASH;
      case CodePoints.LT:
        this.appendNonWhitespace(code);
        return State.SCRIPT_DATA_DOUBLE_ESCAPED_LESS_THAN_SIGN;
      case CodePoints.NUL:
        this.error('unexpected-null-character');
        this.appendNonWhitespace(CodePoints.REPLACEMENT_CHAR);
        return State.SCRIPT_DATA_DOUBLE_ESCAPED;
      case CodePoints.EOF:
        this.error('eof-in-script-html-comment-like-text');
        this.emitAccumulatedCharacters();
        return this.eof();
      default:
        this.appendCharacter(code);
        return State.SCRIPT_DATA_DOUBLE_ESCAPED;
    }
  }

  scriptDataDoubleEscapedDashDash(code: number): State {
    while (true) {
      switch (code) {
        case CodePoints.EOC:
          this.paused = true;
          return State.SCRIPT_DATA_DOUBLE_ESCAPED_DASH_DASH;
        case CodePoints.HYPHEN:
          this.appendNonWhitespace(code);
          code = this.nextCode();
          break;
        case CodePoints.LT:
          this.appendNonWhitespace(code);
          return State.SCRIPT_DATA_DOUBLE_ESCAPED_LESS_THAN_SIGN;
        case CodePoints.GT:
          this.appendNonWhitespace(code);
          return State.SCRIPT_DATA;
        case CodePoints.NUL:
          this.error('unexpected-null-character');
          this.appendNonWhitespace(CodePoints.REPLACEMENT_CHAR);
          return State.SCRIPT_DATA_DOUBLE_ESCAPED;
        case CodePoints.EOF:
          this.error('eof-in-script-html-comment-like-text');
          this.emitAccumulatedCharacters();
          return this.eof();
        default:
          this.appendCharacter(code);
          return State.SCRIPT_DATA_DOUBLE_ESCAPED;
      }
    }
  }

  scriptDataDoubleEscapedLessThanSign(code: number): State {
    if (code === CodePoints.SLASH) {
      this.appendNonWhitespace(code);
      return State.SCRIPT_DATA_DOUBLE_ESCAPE_END;
    } else {
      return this.callState(State.SCRIPT_DATA_DOUBLE_ESCAPED, code);
    }
  }

  scriptDataDoubleEscapeEnd(code: number) {
    return this.matchSequence(code, SCRIPT, true, State.SCRIPT_DATA_DOUBLE_ESCAPE_END_MATCHED, State.SCRIPT_DATA_DOUBLE_ESCAPED);
  }

  scriptDataDoubleEscapeEndMatched(code: number): State {
    switch (code) {
      case CodePoints.TAB:
      case CodePoints.LF:
      case CodePoints.FF:
      case CodePoints.SPACE:
        this.appendWhitespace(code);
        return State.SCRIPT_DATA_ESCAPED;
      case CodePoints.SLASH:
      case CodePoints.GT:
        this.appendNonWhitespace(code);
        return State.SCRIPT_DATA_ESCAPED;
      default:
        return this.callState(State.SCRIPT_DATA_DOUBLE_ESCAPED, code);
    }
  }
  // -----text states-----
  rawtext(code: number): State {
    return this.textDataNoRefs(code, State.RAWTEXT_LESS_THAN_SIGN, State.RAWTEXT);
  }

  rawtextLessThanSign(code: number): State {
    return this.textDataLessThanSign(code, State.RAWTEXT_END_TAG_OPEN, State.RAWTEXT, State.RAWTEXT_LESS_THAN_SIGN);
  }

  rawtextEndTagOpen(code: number): State {
    return this.textDataEndTagOpen(code, State.RAWTEXT_END_TAG_NAME, State.RAWTEXT);
  }

  rawtextEndTagName(code: number): State {
    return this.matchSequence(code, stringToArray(this.lastOpenTag!), true, State.RAWTEXT_END_TAG_NAME_MATCHED, State.RAWTEXT);
  }

  rawtextEndTagNameMatched(code: number): State {
    return this.textDataEndTagMatched(code, State.RAWTEXT);
  }

  rcdata(code: number): State {
    while (true) {
      switch (code) {
        case CodePoints.EOC:
          this.paused = true;
          return State.RCDATA;
        case CodePoints.AMPERSAND:
          this.returnState = this.state;
          this.inAttribute = false;
          return State.CHARACTER_REFERENCE;
        case CodePoints.LT:
          return State.RCDATA_LESS_THAN_SIGN;
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

  rcdataLessThanSign(code: number): State {
    return this.textDataLessThanSign(code, State.RCDATA_END_TAG_OPEN, State.RCDATA, State.RCDATA_LESS_THAN_SIGN);
  }

  rcdataEndTagOpen(code: number): State {
    return this.textDataEndTagOpen(code, State.RCDATA_END_TAG_NAME, State.RCDATA);
  }

  rcdataEndTagName(code: number): State {
    return this.matchSequence(code, stringToArray(this.lastOpenTag!), true, State.RCDATA_END_TAG_NAME_MATCHED, State.RCDATA);
  }

  rcdataEndTagNameMatched(code: number): State {
    return this.textDataEndTagMatched(code, State.RCDATA);
  }
}