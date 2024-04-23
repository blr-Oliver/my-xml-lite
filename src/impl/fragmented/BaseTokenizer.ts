import {FF, GT, isAsciiLowerAlpha, isAsciiUpperAlpha, LF, SOLIDUS, SPACE, TAB} from '../../common/code-points';
import {ParserEnvironment} from '../../decl/ParserEnvironment';
import {Attribute, TagToken} from '../tokens';
import {State} from './states';

export abstract class BaseTokenizer {
  env!: ParserEnvironment;
  returnState!: State;
  currentTag!: TagToken;
  currentAttribute!: Attribute;
  isInAttribute!: boolean;

  protected error(name: string) {
  }

  protected emit(token: any) {
  }
  protected emitCharacter(code: number) {
  }
  protected emitCharacter2(code1: number, code2: number) {
  }
  protected emitCharacter3(code1: number, code2: number, code3: number) {
  }
  protected nextCode(): number {
    return this.env.input.next();
  }
  protected bogusComment(code: number): State {
    throw new TypeError('Malformed inheritance');
  }
  protected data(code: number): State {
    throw new TypeError('Malformed inheritance');
  }
  protected emitCurrentTag() {
    this.emit(this.currentTag);
    // @ts-ignore
    this.currentTag = undefined;
    // @ts-ignore
    this.currentAttribute = undefined;
  }

  protected startNewTag(name: string = '') {
    this.currentTag = {
      name,
      type: 'startTag',
      selfClosing: false,
      attributes: []
    }
  }

  protected startNewAttribute() {
    this.currentTag.attributes.push(this.currentAttribute = {
      name: '',
      value: undefined
    });
  }

  protected emitAccumulatedCharacters() {
    const buffer = this.env.buffer;
    if (buffer.position) {
      this.emit({
        type: 'characters',
        data: buffer.takeString()
      });
    }
  }

  private startTagIfMatches(expectedTag: string, emitIfMatched: boolean = false, fromPosition: number): boolean {
    const buffer = this.env.buffer;
    const name = buffer.getString(fromPosition);
    const matches = name === expectedTag;
    if (matches) {
      this.emitAccumulatedCharacters();
      this.startNewTag(name);
      buffer.clear();
      if (emitIfMatched)
        this.emitCurrentTag();
      return true;
    }
    return false;
  }

  protected callState(state: State, code: number): State {
    // @ts-ignore
    return this[state](code);
  }

  protected expectAsciiTag(code: number, tag: string, failedState: State): State {
    // TODO instead of tag parameter actually use last open tag
    const buffer = this.env.buffer;
    const mark = buffer.position;
    while (true) {
      switch (code) {
        case TAB:
        case LF:
        case FF:
        case SPACE:
          if (this.startTagIfMatches(tag, false, mark)) return 'beforeAttributeName';
          else return this.callState(failedState, code);
        case SOLIDUS:
          if (this.startTagIfMatches(tag, false, mark)) return 'selfClosingStartTag';
          else return this.callState(failedState, code);
        case GT:
          if (this.startTagIfMatches(tag, false, mark)) return 'data';
          else return this.callState(failedState, code);
        default:
          if (isAsciiUpperAlpha(code)) code += 0x20;
          if (isAsciiLowerAlpha(code)) {
            buffer.append(code);
            code = this.nextCode();
          } else
            return this.callState(failedState, code);
      }
    }
  }
}