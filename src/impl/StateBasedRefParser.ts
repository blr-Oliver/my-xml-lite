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
import {CharacterReferenceParser} from '../decl/CharacterReferenceParser';
import {StringBuilder} from '../decl/StringBuilder';
import {CHAR_REF_REPLACEMENT} from './CallBasedCharRefParser';
import {PrefixNode} from './entity-ref-index';

type State = 'ref' | 'numeric' | 'numericEnd' | 'named' | 'hexStart' | 'hex' | 'decimalStart' | 'decimal' | 'ambiguous';

export class StateBasedRefParser implements CharacterReferenceParser {
  output: number[][] = [];
  errors: string[] = [];
  reconsume!: boolean;

  private input!: CharacterSource;
  private charCode!: number;
  private isAttribute!: boolean;
  private state: State | undefined;
  private refLength!: number;

  constructor(private refsIndex: PrefixNode<number[]>,
              private buffer: StringBuilder
  ) {
  }

  parse(input: CharacterSource, isAttribute: boolean) {
    this.input = input;
    this.isAttribute = isAttribute;
    this.reset();
    while (this.state) {
      this.state = this[this.state]();
    }
    if (this.buffer.position)
      this.output.push(this.buffer.getCodes());
    //@ts-ignore
    this.input = undefined;
  }
  private reset() {
    this.state = 'ref';
    this.refLength = 0;
    this.charCode = 0;
    this.reconsume = false;
    this.output.length = 0;
    this.errors.length = 0;
  }
  private ref(): State | undefined {
    this.buffer.clear();
    this.buffer.append(AMPERSAND);
    let code = this.input.next();
    if (code === SHARP) {
      this.buffer.append(code);
      return 'numeric';
    } else if (isAsciiAlphaNum(code))
      return 'named';
  }
  private numeric(): State {
    this.charCode = 0;
    let code = this.input.next();
    if (code === X_CAPITAL || code === X_REGULAR) {
      this.buffer.append(code);
      return 'hexStart';
    } else
      return 'decimalStart';
  }
  private numericEnd(): undefined {
    let code = this.charCode;
    if (code === 0) {
      this.error('null-character-reference');
      code = REPLACEMENT_CHAR;
    } else if (code > 0x10FFFF) {
      this.error('character-reference-outside-unicode-range');
      code = REPLACEMENT_CHAR;
    } else if (isSurrogate(code)) {
      this.error('surrogate-character-reference');
      code = REPLACEMENT_CHAR;
    } else if (isNonCharacter(code)) {
      this.error('noncharacter-character-reference');
    } else if (code === 0x0D || (!isSpace(code) && isControl(code))) {
      this.error('control-character-reference');
      code = CHAR_REF_REPLACEMENT[code - 0x80] || code;
    }
    this.buffer.clear();
    this.buffer.append(code);
    return;
  }
  private named(): State | undefined {
    let code: number = this.input.get();
    let node = this.refsIndex, next: PrefixNode<number[]>;
    let lastMatch = 0x00;
    while (node.children && (next = node.children[code])) {
      node = next;
      this.buffer.append(lastMatch = code);
      code = this.input.next();
    }
    if (node.value) {
      this.reconsume = true;
      if (this.isAttribute && lastMatch !== SEMICOLON && (code === EQ || isAsciiAlphaNum(code))) { // for historical reasons
        return;
      } else {
        if (lastMatch !== SEMICOLON)
          this.error('missing-semicolon-after-character-reference');
        this.buffer.clear();
        this.buffer.appendSequence(node.value);
        return;
      }
    } else
      return 'ambiguous';
  }
  private hexStart(): State | undefined {
    let code = this.input.next();
    if (!isHexDigit(code)) {
      this.reconsume = true;
      this.error('absence-of-digits-in-numeric-character-reference');
    } else
      return 'hex';
  }
  private hex(): State | undefined {
    let code = this.input.get();
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
        this.error('missing-semicolon-after-character-reference');
        this.reconsume = true;
        return 'numericEnd';
      }
      code = this.input.next();
    }
  }
  private decimalStart(): State | undefined {
    let code = this.input.get();
    if (!isDigit(code)) {
      this.reconsume = true;
      this.error('absence-of-digits-in-numeric-character-reference');
    } else
      return 'decimal';
  }
  private decimal(): State | undefined {
    let code = this.input.get();
    while (true) {
      if (isDigit(code)) {
        this.charCode = this.charCode * 10 + code - 0x30;
      } else if (code === SEMICOLON)
        return 'numericEnd';
      else {
        this.error('missing-semicolon-after-character-reference');
        this.reconsume = true;
        return 'numericEnd';
      }
      code = this.input.next();
    }
  }

  private ambiguous(): State | undefined {
    const maxSize = this.buffer.buffer.length;
    this.reconsume = true;
    this.output.push(this.buffer.getCodes());
    this.buffer.clear();
    let code = this.input.get();
    while (true) {
      if (this.buffer.position === maxSize) {
        this.output.push(this.buffer.getCodes());
        this.buffer.clear();
      }
      if (code === SEMICOLON) {
        this.error('unknown-named-character-reference');
        return;
      } else if (isAsciiAlphaNum(code)) {
        this.buffer.append(code);
        code = this.input.next();
      } else
        return;
    }
  }

  private error(name: string) {
    this.errors.push(name);
  }

}