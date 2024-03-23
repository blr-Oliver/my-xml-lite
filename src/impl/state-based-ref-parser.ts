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
import {StringBuilder} from '../decl/StringBuilder';
import {CHAR_REF_REPLACEMENT} from './character-reference-parser';
import {PrefixNode} from './entity-ref-index';

type StateHandler = () => (State | undefined);
type State = Exclude<keyof {
  [K in keyof StateBasedRefParser]: StateHandler extends StateBasedRefParser[K] ? true : never;
}, 'run'>;

export class StateBasedRefParser {
  private input: CharacterSource;
  private refsIndex: PrefixNode<number[]>;
  private buffer: StringBuilder;

  private charCode!: number;
  private isAttribute!: boolean;
  private state: State | undefined;
  private reconsume!: boolean;
  private refLength!: number;

  constructor(input: CharacterSource,
              refsIndex: PrefixNode<number[]>,
              buffer: StringBuilder
  ) {
    this.input = input;
    this.refsIndex = refsIndex;
    this.buffer = buffer
  }

  run(isAttribute: boolean) {
    this.isAttribute = isAttribute;
    this.reset();
    while (this.state) {
      this.state = this[this.state]();
    }
  }
  private reset() {
    this.state = 'ref';
    this.refLength = 0;
    this.charCode = 0;
    this.reconsume = false;
  }
  ref(): State | undefined {
    this.buffer.clear();
    this.buffer.append(AMPERSAND);
    let code = this.input.next();
    if (code === SHARP)
      return 'numeric';
    else if (isAsciiAlphaNum(code))
      return 'named';
  }
  numeric(): State {
    this.charCode = 0;
    let code = this.input.next();
    if (code === X_CAPITAL || code === X_REGULAR) {
      this.buffer.append(code);
      return 'hexStart';
    } else
      return 'decimal';
  }
  numericEnd(): undefined {
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
    return;
  }
  named(): State | undefined {
    return;
  }
  hexStart(): State | undefined {
    let code = this.input.next();
    if (isHexDigit(code))
      return 'hex';
    this.parseError('absence-of-digits-in-numeric-character-reference parse error');
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
        this.parseError('missing-semicolon-after-character-reference');
        this.reconsume = true;
        return 'numericEnd';
      }
      code = this.input.next();
    }
  }
  decimal(): State | undefined {
    let code = this.input.get();
    while (true) {
      if (isDigit(code)) {
        this.charCode = this.charCode * 10 + code - 0x30;
      } else if (code === SEMICOLON)
        return 'numericEnd';
      else {
        this.parseError('missing-semicolon-after-character-reference');
        this.reconsume = true;
        return 'numericEnd';
      }
      code = this.input.next();
    }
  }

  private parseError(name: string) {
  }

}