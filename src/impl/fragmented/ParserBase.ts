import {ParserEnvironment} from '../../decl/ParserEnvironment';
import {Attribute, TagToken} from '../tokens';
import {State} from './states';

export abstract class ParserBase {
  protected env!: ParserEnvironment;
  protected returnState!: State;
  currentTag!: TagToken;
  currentAttribute!: Attribute;

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
        data: buffer.getString()
      });
      buffer.clear();
    }
  }

  protected startTagIfMatches(expectedTag: string, emitIfMatched: boolean = false, fromPosition: number = 2): boolean {
    const buffer = this.env.buffer;
    const name = buffer.getString(fromPosition); // leading "</"
    const matches = name === expectedTag;
    if (matches) {
      this.startNewTag(name);
      buffer.clear();
      if (emitIfMatched)
        this.emitCurrentTag();
      return true;
    }
    return false;
  }
}