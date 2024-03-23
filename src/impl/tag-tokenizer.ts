import {EOF, EXCLAMATION, GT, isAsciiAlpha, isAsciiUpperAlpha, QUESTION, SOLIDUS} from '../common/code-points';
import {CharacterSource} from '../common/stream-source';

type Attribute = {
  name: string;
  value?: string;
}

export class TagTokenizer {
  private name: string = '';
  private isStart: boolean = true;
  private selfClosing: boolean = false;
  private attributes: Attribute[] = [];

  constructor(private source: CharacterSource) {
  }

  externalState(state: string, reconsume: boolean) {

  }

  tagOpen() {
    let code = this.source.next();
    switch (code) {
      case EXCLAMATION:
        this.externalState('markupDeclaration', false);
        return;
      case SOLIDUS:
        return this.endTagOpen();
      case QUESTION:
        this.parseError('unexpected-question-mark-instead-of-tag-name');
        this.startEmptyComment();
        return;
      case EOF:
        this.parseError('eof-before-tag-name');
        this.emit('<');
        this.emit(EOF);
        return;
      default:
        if (isAsciiAlpha(code))
          return this.tagName();
        this.parseError('invalid-first-character-of-tag-name');
        this.emit('<');
        this.externalState('data', true);
    }
  }

  emit(token: any) {
    // TODO
  }

  startEmptyComment() {
    // TODO
    this.externalState('bogusComment', true);
  }

  endTagOpen() {
    let code = this.source.next();
    switch (code) {
      case GT:
        this.parseError('missing-end-tag-name');
        this.externalState('data', false);
        return;
      case EOF:
        this.parseError('eof-before-tag-name');
        this.emit('</');
        this.emit(EOF);
        return;
      default:
        if (isAsciiAlpha(code)) {
          this.isStart = false;
          this.name = '';
          this.attributes = [];
          return this.tagName();
        }
        this.parseError('invalid-first-character-of-tag-name');
        this.startEmptyComment();
    }
  }

  tagName() {
    let code = this.source.get();
    while (true) {
      switch (code) {
        case 0x09:
        case 0x0A:
        case 0x0C:
        case 0x20:
          return this.beforeAttributeName();
        case SOLIDUS:
          return this.selfClosingStartTag();
        case GT:
          this.emit(this);
          this.externalState('data', false);
          return;
        case 0:
          this.parseError('unexpected-null-character');
          this.name += '\uFFFD';
          code = this.source.next();
          break;
        case EOF:
          this.parseError('eof-in-tag');
          this.emit(EOF);
          return;
        default:
          if (isAsciiUpperAlpha(code)) code += 0x20;
          this.name += String.fromCodePoint(code);
          code = this.source.next();
      }
    }
  }

  beforeAttributeName(reconsume: boolean = false) {
    let code = reconsume ? this.source.get() : this.source.next();
    while(true){}
  }

  selfClosingStartTag() {

  }

  parseError(name: string) {

  }
}