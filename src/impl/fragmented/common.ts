import {ParserEnvironment} from '../../decl/ParserEnvironment';

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
}