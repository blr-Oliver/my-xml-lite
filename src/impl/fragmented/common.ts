import {ParserEnvironment} from '../../decl/ParserEnvironment';
import {Attribute, TagToken} from '../tokens';

export type State =
    'data' |
    'rcdata' |
    'rawtext' |
    'scriptData' |
    'plaintext' |
    'tagOpen' |
    'endTagOpen' |
    'tagName' |
    'rcdataLessThanSign' |
    'rcdataEndTagOpen' |
    'rcdataEndTagName' |
    'rawtextLessThanSign' |
    'rawtextEndTagOpen' |
    'rawtextEndTagName' |
    'scriptDataLessThanSign' |
    'scriptDataEndTagOpen' |
    'scriptDataEndTagName' |
    'scriptDataEscapeStart' |
    'scriptDataEscapeStartDash' |
    'scriptDataEscaped' |
    'scriptDataEscapedDash' |
    'scriptDataEscapedDashDash' |
    'scriptDataEscapedLessThanSign' |
    'scriptDataEscapedEndTagOpen' |
    'scriptDataEscapedEndTagName' |
    'scriptDataDoubleEscapeStart' |
    'scriptDataDoubleEscaped' |
    'scriptDataDoubleEscapedDash' |
    'scriptDataDoubleEscapedDashDash' |
    'scriptDataDoubleEscapedLessThanSign' |
    'scriptDataDoubleEscapeEnd' |
    'beforeAttributeName' |
    'attributeName' |
    'afterAttributeName' |
    'beforeAttributeValue' |
    'attributeValueDoubleQuoted' |
    'attributeValueSingleQuoted' |
    'attributeValueUnquoted' |
    'afterAttributeValueQuoted' |
    'selfClosingStartTag' |
    'bogusComment' |
    'markupDeclarationOpen' |
    'commentStart' |
    'commentStartDash' |
    'comment' |
    'commentLessThanSign' |
    'commentLessThanSignBang' |
    'commentLessThanSignBangDash' |
    'commentLessThanSignBangDashDash' |
    'commentEndDash' |
    'commentEnd' |
    'commentEndBang' |
    'doctype' |
    'beforeDoctypeName' |
    'doctypeName' |
    'afterDoctypeName' |
    'afterDoctypePublicKeyword' |
    'beforeDoctypePublicIdentifier' |
    'doctypePublicIdentifierDoubleQuoted' |
    'doctypePublicIdentifierSingleQuoted' |
    'afterDoctypePublicIdentifier' |
    'betweenDoctypePublicAndSystemIdentifiers' |
    'afterDoctypeSystemKeyword' |
    'beforeDoctypeSystemIdentifier' |
    'doctypeSystemIdentifierDoubleQuoted' |
    'doctypeSystemIdentifierSingleQuoted' |
    'afterDoctypeSystemIdentifier' |
    'bogusDoctype' |
    'cdataSection' |
    'cdataSectionBracket' |
    'cdataSectionEnd' |
    'characterReference' |
    'namedCharacterReference' |
    'ambiguousAmpersand' |
    'numericCharacterReference' |
    'hexadecimalCharacterReferenceStart' |
    'decimalCharacterReferenceStart' |
    'hexadecimalCharacterReference' |
    'decimalCharacterReference' |
    'numericCharacterReferenceEnd' |
    'eof' |
    'eoc';

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
}