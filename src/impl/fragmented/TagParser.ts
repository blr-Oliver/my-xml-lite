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
  NUL,
  QUESTION,
  REPLACEMENT_CHAR,
  SINGLE_QUOTE,
  SOLIDUS
} from '../../common/code-points';
import {EOF_TOKEN} from '../tokens';
import {ParserBase, State} from './common';

export abstract class TagParser extends ParserBase {
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
          this.env.buffer.clear();
          return 'tagName';
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
          this.env.buffer.clear();
          // TODO set start flag to false
          return 'tagName';
        }
        this.error('invalid-first-character-of-tag-name');
        return this.bogusComment(code);
    }
  }

  tagName(code: number): State {
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
          // TODO emit current tag
          return 'data'
        case NUL:
          this.error('unexpected-null-character');
          this.env.buffer.append(REPLACEMENT_CHAR);
          code = this.env.input.next();
          break;
        case EOF:
          this.error('eof-in-tag');
          this.emit(EOF_TOKEN);
          return 'eof';
        default:
          if (isAsciiUpperAlpha(code))
            code += 0x20; // toLowerCase
          this.env.buffer.append(code);
          code = this.env.input.next();
      }
    }
  }

  beforeAttributeName(code: number): State {
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
          return 'attributeName';
        default:
          return this.attributeName(code);
      }
    }
  }

  attributeName(code: number): State {
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
          if (isAsciiUpperAlpha(code)) code += 0x20; // toLowerCase
          this.env.buffer.append(code);
      }
      code = this.env.input.next();
    }
  }

  afterAttributeName(code: number): State {
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
          // TODO emit current tag
          return 'data';
        case SOLIDUS:
          return 'selfClosingStartTag';
        case EOF:
          this.error('eof-in-tag');
          this.emit(EOF_TOKEN);
          return 'eof';
        default:
          return 'attributeName';
      }
      code = this.env.input.next();
    }
  }

  beforeAttributeValue(code: number): State {
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
          // TODO emit current tag
          return 'data';
        default:
          return 'attributeValueUnquoted';
      }
    }
  }


  attributeValueDoubleQuoted(code: number): State {
    return this.quotedAttribute(code, DOUBLE_QUOTE);
  }

  attributeValueSingleQuoted(code: number): State {
    return this.quotedAttribute(code, SINGLE_QUOTE);
  }

  private quotedAttribute(code: number, terminator: number): State {
    while (true) {
      switch (code) {
        case terminator:
          return 'afterAttributeValueQuoted';
        case AMPERSAND:
          // TODO call refParser
          break;
        case EOF:
          this.error('eof-in-tag');
          this.emit(EOF_TOKEN);
          return 'eof';
        case NUL:
          this.error('unexpected-null-character');
          code = REPLACEMENT_CHAR;
        default:
          this.env.buffer.append(code);
          code = this.env.input.next();
          break;
      }
    }
  }

  attributeValueUnquoted(code: number): State {
    while (true) {
      switch (code) {
        case 0x20:
        case 0x09:
        case 0x0A:
        case 0x0C:
          return 'beforeAttributeName';
        case AMPERSAND:
          // TODO call refParser
          break;
        case GT:
          // TODO emit current tag
          return 'data';
        case NUL:
          this.error('unexpected-null-character');
          this.env.buffer.append(REPLACEMENT_CHAR);
          code = this.env.input.next();
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
          this.env.buffer.append(code);
          code = this.env.input.next();
      }
    }
  }

  afterAttributeValueQuoted(code: number): State {
    switch (code) {
      case 0x20:
      case 0x09:
      case 0x0A:
      case 0x0C:
        return 'beforeAttributeName';
      case SOLIDUS:
        return 'selfClosingStartTag';
      case GT:
        // TODO emit current tag
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
        // TODO set selfClosing flag to true
        // TODO emit current tag
        return 'data';
      case EOF:
        this.error('eof-in-tag');
        this.error('eof-in-tag');
        this.emit(EOF_TOKEN);
        return 'eof';
      default:
        this.error('unexpected-solidus-in-tag');
        return this.beforeAttributeName(code);
    }
  }
}