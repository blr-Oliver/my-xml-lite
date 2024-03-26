import {
  AMPERSAND,
  DOUBLE_QUOTE,
  EOF,
  EQ,
  EXCLAMATION,
  GT,
  isAsciiAlpha,
  isAsciiUpperAlpha,
  LT,
  QUESTION,
  REPLACEMENT_CHAR,
  SINGLE_QUOTE,
  SOLIDUS
} from '../common/code-points';
import {CharacterSource} from '../common/stream-source';
import {ParserInterface} from '../decl/ParserInterface';
import {StringBuilder} from '../decl/StringBuilder';

type Attribute = {
  name: string;
  value?: string;
}

type State =
    'tagOpen'
    | 'endTagOpen'
    | 'tagName'
    | 'beforeAttributeName'
    | 'attributeName'
    | 'afterAttributeName'
    | 'beforeAttributeValue'
    | 'attributeValueUnquoted'
    | 'attributeValueSingleQuote'
    | 'attributeValueDoubleQuote'
    | 'afterAttributeValue'
    | 'selfClosingStartTag';

export class TagParser {
  private name?: string;
  private isStart: boolean = true;
  private selfClosing: boolean = false;
  private attributes: Attribute[] = [];

  private input!: CharacterSource;
  private buffer!: StringBuilder;
  private errors!: string[];
  private reconsume!: boolean;

  private state: State | undefined;

  constructor() {
  }

  private externalState(state: string, reconsume: boolean) {
    this.reconsume = reconsume;
  }

  parse(io: ParserInterface) {
    this.reset(io);
    while (this.state)
      this.state = this[this.state]();
    io.reconsume = this.reconsume;
    this.forget();
  }

  private reset(io: ParserInterface) {
    this.input = io.input;
    this.buffer = io.buffer;
    this.errors = io.errors;
    this.reconsume = io.reconsume;

    this.state = 'tagOpen';
    this.name = undefined;
    this.isStart = true;
    this.selfClosing = false;
    this.attributes.length = 0;
  }

  private forget() {
    // @ts-ignore
    this.input = undefined;
    // @ts-ignore
    this.buffer = undefined;
    // @ts-ignore
    this.errors = undefined;
  }

  private nextOrReconsume(): number {
    if (this.reconsume) {
      this.reconsume = false;
      return this.input.get();
    }
    return this.input.next();
  }

  private tagOpen(): State | undefined {
    let code = this.nextOrReconsume();
    switch (code) {
      case EXCLAMATION:
        this.externalState('markupDeclaration', false);
        return;
      case SOLIDUS:
        this.isStart = false;
        return 'endTagOpen';
      case QUESTION:
        this.error('unexpected-question-mark-instead-of-tag-name');
        this.startEmptyComment();
        return;
      case EOF:
        this.error('eof-before-tag-name');
        this.emit('<');
        this.emit(EOF);
        return;
      default:
        if (isAsciiAlpha(code)) {
          this.buffer.clear();
          return 'tagName';
        }
        this.error('invalid-first-character-of-tag-name');
        this.emit('<');
        this.externalState('data', true);
        return;
    }
  }

  private endTagOpen(): State | undefined {
    let code = this.input.next();
    switch (code) {
      case GT:
        this.error('missing-end-tag-name');
        this.externalState('data', false);
        return;
      case EOF:
        this.error('eof-before-tag-name');
        this.emit('</');
        this.emit(EOF);
        return;
      default:
        if (isAsciiAlpha(code)) {
          this.buffer.clear();
          this.isStart = false;
          return 'tagName';
        }
        this.error('invalid-first-character-of-tag-name');
        this.startEmptyComment();
    }
  }

  private tagName(): State | undefined {
    let result = this.doTagName();
    this.name = this.buffer.toString();
    this.buffer.clear();
    return result;
  }
  private doTagName(): State | undefined {
    let code = this.input.get();
    while (true) {
      switch (code) {
        case 0x20:
        case 0x09:
        case 0x0A:
        case 0x0C:
          return 'beforeAttributeName';
        case SOLIDUS:
          return 'selfClosingStartTag';
        case GT:
          this.name = this.buffer.getString();
          this.emit(this);
          this.externalState('data', false);
          return;
        case 0:
          this.error('unexpected-null-character');
          this.buffer.append(REPLACEMENT_CHAR);
          code = this.input.next();
          break;
        case EOF:
          this.error('eof-in-tag');
          this.emit(EOF);
          return;
        default:
          if (isAsciiUpperAlpha(code))
            code += 0x20; // toLowerCase
          this.buffer.append(code);
          code = this.input.next();
      }
    }
  }

  private beforeAttributeName(): State | undefined {
    let code = this.nextOrReconsume();
    while (true) {
      switch (code) {
        case 0x20:
        case 0x09:
        case 0x0A:
        case 0x0C:
          code = this.input.next();
          break;
        case SOLIDUS:
        case GT:
        case EOF:
          return 'afterAttributeName';
        case EQ:
          this.error('unexpected-equals-sign-before-attribute-name');
          this.buffer.append(code);
          this.input.next();
        default:
          return 'attributeName';
      }
    }
  }

  private attributeName(): State | undefined {
    let result = this.doAttributeName();
    this.attributes.push({name: this.buffer.getString()});
    this.buffer.clear();
    return result;
  }
  private doAttributeName(): State | undefined {
    let code = this.input.get();
    while (true) {
      switch (code) {
        case EQ:
          return 'beforeAttributeValue';
        case GT:
        case SOLIDUS:
        case 0x20:
        case 0x09:
        case 0x0A:
        case 0x0C:
        case EOF:
          return 'afterAttributeName';
        case 0x00:
          this.name += '\uFFFD';
          this.error('unexpected-null-character');
          break;
        case SINGLE_QUOTE:
        case DOUBLE_QUOTE:
        case LT:
          this.error('unexpected-character-in-attribute-name');
        default:
          if (isAsciiUpperAlpha(code))
            code += 0x20; // toLowerCase
          this.buffer.append(code);
      }
      code = this.input.next();
    }
  }

  private afterAttributeName(): State | undefined {
    let code = this.input.get();
    while (true) {
      switch (code) {
        case EQ:
          return 'beforeAttributeValue';
        case 0x20:
        case 0x09:
        case 0x0A:
        case 0x0C:
          break;
        case GT:
          this.externalState('data', false);
          this.emit(this);
          return;
        case SOLIDUS:
          return 'selfClosingStartTag';
        case EOF:
          this.error('eof-in-tag');
          this.emit(EOF);
          return;
        default:
          return 'attributeName';
      }
      code = this.input.next();
    }
  }

  private beforeAttributeValue(): State | undefined {
    let code = this.input.next();
    while (true) {
      switch (code) {
        case 0x20:
        case 0x09:
        case 0x0A:
        case 0x0C:
          break;
        case DOUBLE_QUOTE:
          return 'attributeValueDoubleQuote';
        case SINGLE_QUOTE:
          return 'attributeValueSingleQuote';
        case GT:
          this.error('missing-attribute-value parse error');
          this.externalState('data', false);
          this.emit(this);
          return;
        default:
          return 'attributeValueUnquoted';
      }
    }
  }


  private attributeValueDoubleQuote(): State | undefined {
    return this.quotedAttribute(DOUBLE_QUOTE);
  }

  private attributeValueSingleQuote(): State | undefined {
    return this.quotedAttribute(SINGLE_QUOTE);
  }

  private quotedAttribute(terminator: number): State | undefined {
    let result = this.doQuotedAttribute(terminator);
    this.attributes[this.attributes.length - 1].value = this.buffer.getString();
    this.buffer.clear();
    return result;
  }
  private doQuotedAttribute(terminator: number): State | undefined {
    let code = this.input.next();
    while (true) {
      switch (code) {
        case terminator:
          return 'afterAttributeValue';
        case AMPERSAND:
          // TODO call refParser
          code = this.nextOrReconsume();
          break;
        case EOF:
          this.error('eof-in-tag');
          this.emit(EOF);
          return;
        case 0x00:
          this.error('unexpected-null-character');
          code = REPLACEMENT_CHAR;
        default:
          this.buffer.append(code);
          code = this.input.next();
          break;
      }
    }
  }

  private attributeValueUnquoted(): State | undefined {
    let result = this.doAttributeValueUnquoted();
    this.attributes[this.attributes.length - 1].value = this.buffer.getString();
    this.buffer.clear();
    return result;
  }
  private doAttributeValueUnquoted(): State | undefined {
    let code = this.input.get();
    while (true) {
      switch (code) {
        case 0x20:
        case 0x09:
        case 0x0A:
        case 0x0C:
          return 'beforeAttributeName';
        case AMPERSAND:
          // TODO call refParser
          code = this.nextOrReconsume();
          break;
        case GT:
          this.externalState('data', false);
          this.emit(this);
          return;
        case 0x00:
          this.error('unexpected-null-character');
          this.buffer.append(REPLACEMENT_CHAR);
          code = this.input.next();
          break;
        case EOF:
          this.error('eof-in-tag');
          this.emit(EOF);
          return;
        case DOUBLE_QUOTE:
        case SINGLE_QUOTE:
        case LT:
        case EQ:
        case 0x60: // grave accent (`)
          this.error('unexpected-character-in-unquoted-attribute-value');
        default:
          this.buffer.append(code);
          code = this.input.next();
      }
    }
  }

  private afterAttributeValue(): State | undefined {
    switch (this.input.next()) {
      case 0x20:
      case 0x09:
      case 0x0A:
      case 0x0C:
        return 'beforeAttributeName';
      case SOLIDUS:
        return 'selfClosingStartTag';
      case GT:
        this.externalState('data', false);
        this.emit(this);
        return;
      case EOF:
        this.error('eof-in-tag');
        this.emit(EOF);
        return;
      default:
        this.error('missing-whitespace-between-attributes');
        this.reconsume = true;
        return 'beforeAttributeName';
    }
  }

  private selfClosingStartTag(): State | undefined {
    switch (this.input.next()) {
      case GT:
        this.selfClosing = true;
        this.externalState('data', false);
        this.emit(this);
        return;
      case EOF:
        this.error('eof-in-tag');
        this.emit(EOF);
        return;
      default:
        this.error('unexpected-solidus-in-tag');
        this.reconsume = true;
        return 'beforeAttributeName';
    }
  }

  private emit(token: any) {
    // TODO
  }

  private startEmptyComment() {
    // TODO
    this.externalState('bogusComment', true);
  }

  private error(name: string) {
    this.errors.push(name);
  }
}