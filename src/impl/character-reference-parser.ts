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
} from '../common/code-points';
import {CharacterSource} from '../common/stream-source';
import {StringBuilder} from '../decl/StringBuilder';
import {PrefixNode} from './entity-ref-index';

export const CHAR_REF_REPLACEMENT: number[] = [
  0x20AC, 0x0000, 0x201A, 0x0192, 0x201E, 0x2026, 0x2020, 0x2021,
  0x02C6, 0x2030, 0x0160, 0x2039, 0x0152, 0x0000, 0x017D, 0x0000,
  0x0000, 0x2018, 0x2019, 0x201C, 0x201D, 0x2022, 0x2013, 0x2014,
  0x02DC, 0x2122, 0x0161, 0x203A, 0x0153, 0x0000, 0x017E, 0x0178
] as const;

export class CharacterReferenceParser {
  private charCode: number = 0;
  private isAttribute: boolean = false;
  reconsume: boolean = true;

  constructor(private input: CharacterSource,
              private refsIndex: PrefixNode<number[]>,
              private buffer: StringBuilder) {
  }

  parse(isAttribute: boolean) {
    this.isAttribute = isAttribute;
    this.buffer.clear();
    this.buffer.append(AMPERSAND);
    this.characterReference();
  }
  private characterReference() {
    let code = this.input.next();
    if (code === SHARP)
      return this.numeric();
    if (isAsciiAlphaNum(code))
      return this.named(code);
    this.flush();
  }
  private numeric() {
    this.charCode = 0;
    let code = this.input.next();
    if (code === X_CAPITAL || code === X_REGULAR) {
      this.buffer.append(code);
      return this.hexStart();
    }
    return this.decimal(code);
  }
  private numericEnd(reconsume: boolean = false) {
    let code = this.charCode;
    if (code === 0) {
      this.parseError('null-character-reference');
      code = REPLACEMENT_CHAR;
    } else if (code > 0x10FFFF) {
      this.parseError('character-reference-outside-unicode-range');
      code = REPLACEMENT_CHAR;
    } else if (isSurrogate(code)) {
      this.parseError('surrogate-character-reference');
      code = REPLACEMENT_CHAR;
    } else if (isNonCharacter(code)) {
      this.parseError('noncharacter-character-reference');
    } else if (code === 0x0D || (!isSpace(code) && isControl(code))) {
      this.parseError('control-character-reference');
      code = CHAR_REF_REPLACEMENT[code - 0x80] || code;
    }
    this.buffer.clear();
    this.buffer.append(code);
    this.flush(reconsume);
  }
  private hexStart() {
    let code = this.input.next();
    if (isHexDigit(code))
      return this.hex(code);
    this.parseError('absence-of-digits-in-numeric-character-reference parse error');
    this.flush();
  }
  private hex(code: number) {
    while (true) {
      if (code === SEMICOLON) {
        return this.numericEnd();
      } else if (isDigit(code)) {
        this.charCode = this.charCode * 16 + code - 0x30;
      } else if (isUpperHexDigit(code)) {
        this.charCode = this.charCode * 16 + code - 0x37;
      } else if (isLowerHexDigit(code)) {
        this.charCode = this.charCode * 16 + code - 0x57;
      } else {
        this.parseError('missing-semicolon-after-character-reference');
        return this.numericEnd(true);
      }
      code = this.input.next();
    }
  }
  private decimal(code: number) {
    while (true) {
      if (code === SEMICOLON)
        return this.numericEnd();
      else if (isDigit(code)) {
        this.charCode = this.charCode * 10 + code - 0x30;
      } else {
        this.parseError('missing-semicolon-after-character-reference');
        return this.numericEnd(true);
      }
      code = this.input.next();
    }
  }
  private named(code: number) {
    let node = this.refsIndex, next: PrefixNode<number[]>;
    let lastMatch = 0x00;
    while (node.children && (next = node.children[code])) {
      node = next;
      this.buffer.append(lastMatch = code);
      code = this.input.next();
    }
    if (node.value) {
      if (this.isAttribute && lastMatch !== SEMICOLON && (code === EQ || isAsciiAlphaNum(code))) {
        this.flush();
      } else {
        if (lastMatch !== SEMICOLON)
          this.parseError('missing-semicolon-after-character-reference');
        this.buffer.clear();
        this.buffer.appendSequence(node.value);
        this.flush();
      }
    } else {
      this.ambiguous(code);
    }
  }

  private ambiguous(code: number) {
    while (true) {
      if (isAsciiAlphaNum(code)) {
        this.buffer.append(code);
        code = this.input.next();
      } else {
        if (code === SEMICOLON)
          this.parseError('unknown-named-character-reference');
        this.flush();
        break;
      }
    }
  }

  private flush(reconsume: boolean = true) {
    this.reconsume = reconsume;
  }

  private parseError(name: string) {
  }
}