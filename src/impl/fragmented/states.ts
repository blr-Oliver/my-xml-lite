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
    'eof' |
    'eoc' |
    'sequence';
