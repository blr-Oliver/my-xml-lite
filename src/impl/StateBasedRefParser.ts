import {
  AMPERSAND,
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

type State = 'ref' | 'numeric' | 'numericEnd' | 'named' | 'hexStart' | 'hex' | 'decimalStart' | 'decimal';

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
  ref(): State | undefined {
    this.buffer.clear();
    this.buffer.append(AMPERSAND);
    let code = this.input.next();
    if (code === SHARP) {
      this.buffer.append(code);
      return 'numeric';
    } else if (isAsciiAlphaNum(code))
      return 'named';
  }
  numeric(): State {
    this.charCode = 0;
    let code = this.input.next();
    if (code === X_CAPITAL || code === X_REGULAR) {
      this.buffer.append(code);
      return 'hexStart';
    } else
      return 'decimalStart';
  }
  numericEnd(): undefined {
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
  named(): State | undefined {
    // TODO
    return;
  }
  hexStart(): State | undefined {
    let code = this.input.next();
    if (isHexDigit(code))
      return 'hex';
    this.error('absence-of-digits-in-numeric-character-reference');
  }
  hex(): State | undefined {
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
  decimalStart(): State | undefined {
    let code = this.input.get();
    if (!isDigit(code)) {
      this.reconsume = true;
      this.error('absence-of-digits-in-numeric-character-reference');
    } else
      return 'decimal';
  }
  decimal(): State | undefined {
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

  private error(name: string) {
    this.errors.push(name);
  }

}