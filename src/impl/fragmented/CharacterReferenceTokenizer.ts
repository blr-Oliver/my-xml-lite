import {
  AMPERSAND,
  EQ,
  isAsciiAlphaNum,
  isControl,
  isDigit,
  isHexDigit,
  isLowerHexDigit,
  isNonCharacter,
  isSpace,
  isSurrogate,
  isUpperHexDigit,
  REPLACEMENT_CHAR,
  SEMICOLON,
  SHARP,
  X_CAPITAL,
  X_REGULAR
} from '../../common/code-points';
import {CHAR_REF_REPLACEMENT, PrefixNode} from '../character-reference/entity-ref-index';
import {BaseTokenizer} from './BaseTokenizer';
import {State} from './states';

export class CharacterReferenceTokenizer extends BaseTokenizer {
  referenceStartMark!: number;
  charCode!: number;
  refsIndex!: PrefixNode<number[]>;

  constructor(refsIndex: PrefixNode<number[]>) {
    super();
    this.refsIndex = refsIndex;
  }

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
}