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
} from '../../common/code-points';
import {ParserEnvironment} from '../../decl/ParserEnvironment';
import {Attribute, EOF_TOKEN, TagToken, TextToken, Token} from '../tokens';
import {State} from './common';

export class TagParser {
  private name?: string;
  private isStart: boolean = true;
  private selfClosing: boolean = false;
  private attributes: Attribute[] = [];

  private env!: ParserEnvironment;

  constructor() {
  }

  private externalState(state: string, reconsume: boolean) {
    this.env.state = state;
    this.env.reconsume = reconsume;
  }

  // TODO this must be part of complete parser
  parse(env: ParserEnvironment) {
    this.env = env;
    this.reset();
    let state: State | undefined = env.state as State ?? 'tagOpen';
    while (state)
      env.state = state = (this as any)[state]();
    this.forget();
  }

  private reset() {
    this.name = undefined;
    this.isStart = true;
    this.selfClosing = false;
    this.attributes.length = 0;
  }

  private forget() {
    // @ts-ignore
    this.env = undefined;
  }

  private nextOrReconsume(): number {
    if (this.env.reconsume) {
      this.env.reconsume = false;
      return this.env.input.get();
    }
    return this.env.input.next();
  }

  private reconsumeIn(state: State): State {
    this.env.reconsume = true;
    return state;
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
        this.emitCharacters('<');
        return this.emit(EOF_TOKEN);
      default:
        if (isAsciiAlpha(code)) {
          this.env.buffer.clear();
          return 'tagName';
        }
        this.error('invalid-first-character-of-tag-name');
        this.emitCharacters('<');
        this.externalState('data', true);
        return;
    }
  }

  private endTagOpen(): State | undefined {
    let code = this.env.input.next();
    switch (code) {
      case GT:
        this.error('missing-end-tag-name');
        this.externalState('data', false);
        return;
      case EOF:
        this.error('eof-before-tag-name');
        this.emitCharacters('</');
        return this.emit(EOF_TOKEN);
      default:
        if (isAsciiAlpha(code)) {
          this.env.buffer.clear();
          this.isStart = false;
          return 'tagName';
        }
        this.error('invalid-first-character-of-tag-name');
        this.startEmptyComment();
    }
  }

  private tagName(): State | undefined {
    let result = this.doTagName();
    this.name = this.env.buffer.toString();
    this.env.buffer.clear();
    return result;
  }
  private doTagName(): State | undefined {
    let code = this.env.input.get();
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
          this.name = this.env.buffer.getString();
          return this.emitTag();
        case 0:
          this.error('unexpected-null-character');
          this.env.buffer.append(REPLACEMENT_CHAR);
          code = this.env.input.next();
          break;
        case EOF:
          this.error('eof-in-tag');
          return this.emit(EOF_TOKEN);
        default:
          if (isAsciiUpperAlpha(code))
            code += 0x20; // toLowerCase
          this.env.buffer.append(code);
          code = this.env.input.next();
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
          code = this.env.input.next();
          break;
        case SOLIDUS:
        case GT:
        case EOF:
          return 'afterAttributeName';
        case EQ:
          this.error('unexpected-equals-sign-before-attribute-name');
          this.env.buffer.append(code);
          this.env.input.next();
        default:
          return 'attributeName';
      }
    }
  }

  private attributeName(): State | undefined {
    let result = this.doAttributeName();
    this.attributes.push({name: this.env.buffer.getString()});
    this.env.buffer.clear();
    return result;
  }
  private doAttributeName(): State | undefined {
    let code = this.env.input.get();
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
          this.error('unexpected-null-character');
          this.env.buffer.append(REPLACEMENT_CHAR);
          break;
        case SINGLE_QUOTE:
        case DOUBLE_QUOTE:
        case LT:
          this.error('unexpected-character-in-attribute-name');
        default:
          if (isAsciiUpperAlpha(code))
            code += 0x20; // toLowerCase
          this.env.buffer.append(code);
      }
      code = this.env.input.next();
    }
  }

  private afterAttributeName(): State | undefined {
    let code = this.env.input.get();
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
          return this.emitTag();
        case SOLIDUS:
          return 'selfClosingStartTag';
        case EOF:
          this.error('eof-in-tag');
          return this.emit(EOF_TOKEN);
        default:
          return 'attributeName';
      }
      code = this.env.input.next();
    }
  }

  private beforeAttributeValue(): State | undefined {
    let code = this.env.input.next();
    while (true) {
      switch (code) {
        case 0x20:
        case 0x09:
        case 0x0A:
        case 0x0C:
          break;
        case DOUBLE_QUOTE:
          return 'attributeValueDoubleQuoted';
        case SINGLE_QUOTE:
          return 'attributeValueSingleQuoted';
        case GT:
          this.error('missing-attribute-value');
          return this.emitTag();
        default:
          return 'attributeValueUnquoted';
      }
    }
  }


  attributeValueDoubleQuoted(): State | undefined {
    return this.quotedAttribute(DOUBLE_QUOTE);
  }

  attributeValueSingleQuoted(): State | undefined {
    return this.quotedAttribute(SINGLE_QUOTE);
  }

  private quotedAttribute(terminator: number): State | undefined {
    let result = this.doQuotedAttribute(terminator);
    this.attributes[this.attributes.length - 1].value = this.env.buffer.getString();
    this.env.buffer.clear();
    return result;
  }
  private doQuotedAttribute(terminator: number): State | undefined {
    let code = this.env.input.next();
    while (true) {
      switch (code) {
        case terminator:
          return 'afterAttributeValueQuoted';
        case AMPERSAND:
          // TODO call refParser
          code = this.nextOrReconsume();
          break;
        case EOF:
          this.error('eof-in-tag');
          return this.emit(EOF_TOKEN);
        case 0x00:
          this.error('unexpected-null-character');
          code = REPLACEMENT_CHAR;
        default:
          this.env.buffer.append(code);
          code = this.env.input.next();
          break;
      }
    }
  }

  attributeValueUnquoted(): State | undefined {
    let result = this.doAttributeValueUnquoted();
    this.attributes[this.attributes.length - 1].value = this.env.buffer.getString();
    this.env.buffer.clear();
    return result;
  }
  private doAttributeValueUnquoted(): State | undefined {
    let code = this.env.input.get();
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
          return this.emitTag();
        case 0x00:
          this.error('unexpected-null-character');
          this.env.buffer.append(REPLACEMENT_CHAR);
          code = this.env.input.next();
          break;
        case EOF:
          this.error('eof-in-tag');
          return this.emit(EOF_TOKEN);
        case DOUBLE_QUOTE:
        case SINGLE_QUOTE:
        case LT:
        case EQ:
        case 0x60: // grave accent (`)
          this.error('unexpected-character-in-unquoted-attribute-value');
        default:
          this.env.buffer.append(code);
          code = this.env.input.next();
      }
    }
  }

  afterAttributeValueQuoted(): State | undefined {
    switch (this.env.input.next()) {
      case 0x20:
      case 0x09:
      case 0x0A:
      case 0x0C:
        return 'beforeAttributeName';
      case SOLIDUS:
        return 'selfClosingStartTag';
      case GT:
        return this.emitTag();
      case EOF:
        this.error('eof-in-tag');
        return this.emit(EOF_TOKEN);
      default:
        this.error('missing-whitespace-between-attributes');
        return this.reconsumeIn('beforeAttributeName');
    }
  }

  selfClosingStartTag(): State | undefined {
    switch (this.env.input.next()) {
      case GT:
        this.selfClosing = true;
        return this.emitTag();
      case EOF:
        this.error('eof-in-tag');
        return this.emit(EOF_TOKEN);
      default:
        this.error('unexpected-solidus-in-tag');
        return this.reconsumeIn('beforeAttributeName');
    }
  }

  // TODO make following methods part of common interface

  private emitCharacters(data: string): undefined {
    this.env.tokens!.emit({type: 'characters', data} as TextToken);
    return;
  }

  private emitTag(): undefined {
    this.externalState('data', false);
    this.env.tokens!.emit({
      type: this.isStart ? 'startTag' : 'endTag',
      name: this.name!,
      selfClosing: this.selfClosing,
      attributes: this.attributes.slice()
    } as TagToken);
    return;
  }

  private emit(token: Token): undefined {
    this.env.tokens!.emit(token);
    return;
  }

  private startEmptyComment() {
    // TODO
    this.externalState('bogusComment', true);
  }

  private error(name: string) {
    this.env.errors.push(name);
  }
}