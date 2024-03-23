import {CharacterSource} from '../common/stream-source';
import {Tokenizer} from '../decl/lexer-decl';
import {FixedSizeStringBuilder} from './tokenizer-impl';
import StringBuilder = Tokenizer.StringBuilder;

export class CharacterReferenceParser {
  buffer: StringBuilder;
  reconsume: boolean = false;
  errors: string[] = [];
  private input!: CharacterSource;
  private isAttribute!: boolean;

  constructor() {
    this.buffer = new FixedSizeStringBuilder(32);
  }

  parse(input: CharacterSource, isAttribute: boolean) {
    this.input = input;
    this.isAttribute = isAttribute;
    this.errors.length = 0;
    this.buffer.clear();
  }
}