import {
  AMPERSAND,
  DOUBLE_QUOTE,
  EOF,
  EQ,
  EXCLAMATION,
  FF,
  GT,
  isAsciiAlpha,
  isAsciiUpperAlpha,
  LF,
  LT,
  NUL,
  QUESTION,
  REPLACEMENT_CHAR,
  SINGLE_QUOTE,
  SOLIDUS,
  SPACE,
  TAB
} from '../../common/code-points';
import {EOF_TOKEN} from '../tokens';
import {BaseTokenizer} from './BaseTokenizer';
import {State} from './states';

export abstract class TagTokenizer extends BaseTokenizer {

  tagOpen(code: number): State {
    switch (code) {
      case EXCLAMATION:
        return 'markupDeclarationOpen';
      case SOLIDUS:
        return 'endTagOpen';
      case QUESTION:
        this.error('unexpected-question-mark-instead-of-tag-name');
        return this.bogusComment(code);
      case EOF:
        this.error('eof-before-tag-name');
        this.emitCharacter(LT);
        this.emit(EOF_TOKEN);
        return 'eof';
      default:
        if (isAsciiAlpha(code)) {
          this.emitAccumulatedCharacters();
          this.startNewTag();
          return this.tagName(code);
        }
        this.error('invalid-first-character-of-tag-name');
        this.emitCharacter(LT);
        return this.data(code);
    }
  }

  endTagOpen(code: number): State {
    switch (code) {
      case GT:
        this.error('missing-end-tag-name');
        return 'data';
      case EOF:
        this.error('eof-before-tag-name');
        this.emitCharacter2(LT, SOLIDUS);
        this.emit(EOF_TOKEN);
        return 'eof';
      default:
        if (isAsciiAlpha(code)) {
          this.emitAccumulatedCharacters();
          this.currentTag.type = 'endTag';
          return this.tagName(code);
        }
        this.error('invalid-first-character-of-tag-name');
        return this.bogusComment(code);
    }
  }

  tagName(code: number): State {
    const buffer = this.env.buffer;
    while (true) {
      switch (code) {
        case TAB:
        case LF:
        case FF:
        case SPACE:
          this.currentTag.name = buffer.takeString();
          return 'beforeAttributeName';
        case SOLIDUS:
          this.currentTag.name = buffer.takeString();
          return 'selfClosingStartTag';
        case GT:
          this.currentTag.name = buffer.takeString();
          this.emitCurrentTag();
          return 'data';
        case EOF:
          this.error('eof-in-tag');
          this.emit(EOF_TOKEN);
          return 'eof';
        case NUL:
          this.error('unexpected-null-character');
          code = REPLACEMENT_CHAR;
        default:
          if (isAsciiUpperAlpha(code)) code += 0x20; // toLowerCase
          buffer.append(code);
          code = this.env.input.next();
      }
    }
  }

  beforeAttributeName(code: number): State {
    while (true) {
      switch (code) {
        case TAB:
        case LF:
        case FF:
        case SPACE:
          code = this.env.input.next();
          break;
        case SOLIDUS:
        case GT:
        case EOF:
          return this.afterAttributeName(code);
        case EQ:
          this.error('unexpected-equals-sign-before-attribute-name');
          this.startNewAttribute();
          this.env.buffer.append(code);
          return 'attributeName';
        default:
          this.startNewAttribute();
          return this.attributeName(code);
      }
    }
  }

  attributeName(code: number): State {
    const buffer = this.env.buffer;
    while (true) {
      switch (code) {
        case EQ:
          this.currentAttribute.name = buffer.takeString();
          return 'beforeAttributeValue';
        case TAB:
        case LF:
        case FF:
        case SPACE:
        case GT:
        case SOLIDUS:
        case EOF:
          this.currentAttribute.name = buffer.takeString();
          return this.afterAttributeName(code);
        case NUL:
          this.error('unexpected-null-character');
          buffer.append(REPLACEMENT_CHAR);
          break;
        case SINGLE_QUOTE:
        case DOUBLE_QUOTE:
        case LT:
          this.error('unexpected-character-in-attribute-name');
        default:
          if (isAsciiUpperAlpha(code)) code += 0x20; // toLowerCase
          buffer.append(code);
      }
      code = this.env.input.next();
    }
  }

  afterAttributeName(code: number): State {
    while (true) {
      switch (code) {
        case EQ:
          return 'beforeAttributeValue';
        case TAB:
        case LF:
        case FF:
        case SPACE:
          code = this.nextCode();
          break;
        case GT:
          this.emitCurrentTag();
          return 'data';
        case SOLIDUS:
          return 'selfClosingStartTag';
        case EOF:
          this.error('eof-in-tag');
          this.emit(EOF_TOKEN);
          return 'eof';
        default:
          this.startNewAttribute();
          return this.attributeName(code);
      }
    }
  }

  beforeAttributeValue(code: number): State {
    while (true) {
      switch (code) {
        case TAB:
        case LF:
        case FF:
        case SPACE:
          break;
        case DOUBLE_QUOTE:
          return 'attributeValueDoubleQuoted';
        case SINGLE_QUOTE:
          return 'attributeValueSingleQuoted';
        case GT:
          this.error('missing-attribute-value');
          this.emitCurrentTag();
          return 'data';
        default:
          return this.attributeValueUnquoted(code);
      }
    }
  }


  attributeValueDoubleQuoted(code: number): State {
    return this.attributeValueQuoted(code, DOUBLE_QUOTE);
  }

  attributeValueSingleQuoted(code: number): State {
    return this.attributeValueQuoted(code, SINGLE_QUOTE);
  }

  private attributeValueQuoted(code: number, terminator: number): State {
    const buffer = this.env.buffer;
    while (true) {
      switch (code) {
        case terminator:
          this.currentAttribute.value = buffer.takeString();
          return 'afterAttributeValueQuoted';
        case AMPERSAND:
          this.returnState = this.state;
          this.inAttribute = true;
          return 'characterReference';
        case EOF:
          this.error('eof-in-tag');
          this.emit(EOF_TOKEN);
          return 'eof';
        case NUL:
          this.error('unexpected-null-character');
          code = REPLACEMENT_CHAR;
        default:
          buffer.append(code);
          code = this.env.input.next();
          break;
      }
    }
  }

  attributeValueUnquoted(code: number): State {
    const buffer = this.env.buffer;
    while (true) {
      switch (code) {
        case TAB:
        case LF:
        case FF:
        case SPACE:
          this.currentAttribute.value = buffer.takeString();
          return 'beforeAttributeName';
        case AMPERSAND:
          this.returnState = this.state;
          this.inAttribute = true;
          return 'characterReference';
        case GT:
          this.currentAttribute.value = buffer.takeString();
          this.emitCurrentTag();
          return 'data';
        case NUL:
          this.error('unexpected-null-character');
          buffer.append(REPLACEMENT_CHAR);
          code = this.nextCode();
          break;
        case EOF:
          this.error('eof-in-tag');
          this.emit(EOF_TOKEN);
          return 'eof';
        case DOUBLE_QUOTE:
        case SINGLE_QUOTE:
        case LT:
        case EQ:
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
      case TAB:
      case LF:
      case FF:
      case SPACE:
        return 'beforeAttributeName';
      case SOLIDUS:
        return 'selfClosingStartTag';
      case GT:
        this.emitCurrentTag();
        return 'data';
      case EOF:
        this.error('eof-in-tag');
        this.emit(EOF_TOKEN);
        return 'eof';
      default:
        this.error('missing-whitespace-between-attributes');
        return this.beforeAttributeName(code);
    }
  }

  selfClosingStartTag(code: number): State {
    switch (code) {
      case GT:
        this.currentTag.selfClosing = true;
        this.emitCurrentTag();
        return 'data';
      case EOF:
        this.error('eof-in-tag');
        this.emit(EOF_TOKEN);
        return 'eof';
      default:
        this.error('unexpected-solidus-in-tag');
        return this.beforeAttributeName(code);
    }
  }
}