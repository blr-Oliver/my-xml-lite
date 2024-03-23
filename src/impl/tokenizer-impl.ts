import {
  AMPERSAND,
  CD_END,
  CD_START,
  DOUBLE_QUOTE,
  EOF,
  EQ,
  EXCLAMATION,
  GT,
  hexDigitToValue,
  HYPHEN,
  isNameChar,
  isNameStartChar,
  isSpace,
  KNOWN_ENTITIES,
  LT,
  OPEN_SQUARE_BRACKET,
  QUESTION,
  SEMICOLON,
  SHARP,
  SINGLE_QUOTE,
  SLASH,
  X_CAPITAL,
  X_REGULAR
} from '../common/code-points';
import {CharacterSource} from '../common/stream-source';
import {Tokenizer} from '../decl/lexer-decl';
import {StringBuilder} from '../decl/StringBuilder';

const CD_START_TAIL = CD_START.slice(2);

export abstract class TokenizerImpl implements Tokenizer.TokenizerInternals {
  declare input: CharacterSource;
  declare stringBuilder: StringBuilder;

  nextToken(): Tokenizer.Token | null {
    switch (this.input.get()) {
      case EOF:
        return null;
      case LT:
        return this.lt();
      default:
        let data = this.text(true, [LT]);
        return {
          type: Tokenizer.TokenType.TEXT_NODE,
          data
        } as Tokenizer.CharacterData;
    }
  }
  lt(): Tokenizer.Token {
    let code = this.input.next();
    switch (code) {
      case EXCLAMATION:
        return this.exclamation();
      case QUESTION:
        return this.processingInstruction();
      case SLASH:
        return this.endTag();
      default:
        return this.startTag();
    }
  }
  exclamation(): Tokenizer.Token {
    let code = this.input.next();
    switch (code) {
      case OPEN_SQUARE_BRACKET:
        return this.cdata();
      default:
        if (isNameChar(code))
          return this.declaration();
        else
          return this.comment();
    }
  }
  comment(): Tokenizer.CharacterData {
    return {
      type: Tokenizer.TokenType.COMMENT_NODE,
      data: this.delimitedChars([HYPHEN, HYPHEN], [HYPHEN, HYPHEN, GT], [GT])
    } as Tokenizer.CharacterData;
  }
  cdata(): Tokenizer.CharacterData {
    return {
      type: Tokenizer.TokenType.CDATA_SECTION_NODE,
      data: this.delimitedChars(CD_START_TAIL, CD_END, [GT])
    } as Tokenizer.CharacterData;
  }
  declaration(): Tokenizer.Declaration {
    let prolog = this.name();
    if (prolog !== 'DOCTYPE')
      this.unexpected();
    this.skipWhitespace(true);
    let name = this.name();
    if (!name)
      this.unexpected();
    this.skipWhitespace();
    let result: Tokenizer.Declaration = {
      type: Tokenizer.TokenType.DOCUMENT_TYPE_NODE,
      name
    };
    if (isNameChar(this.input.get())) {
      let idClassifier = this.name();
      if (idClassifier === 'PUBLIC') {
        this.skipWhitespace(true);
        result.publicId = this.publicId();
        this.skipWhitespace(true);
        result.systemId = this.systemId();
        this.skipWhitespace();
      } else if (idClassifier === 'SYSTEM') {
        this.skipWhitespace(true);
        result.systemId = this.publicId();
        this.skipWhitespace();
      } else {
        this.unexpected();
      }
    }
    if (this.input.get() === OPEN_SQUARE_BRACKET) {
      result.inline = this.inlineDeclaration();
      this.skipWhitespace();
    }
    if (this.input.get() !== GT)
      this.unexpected();
    return result;
  }
  // TODO publicId/systemId need slightly different handling, especially no entity resolution
  publicId(): string {
    return this.attributeValue();
  }
  systemId(): string {
    return this.attributeValue();
  }
  inlineDeclaration() {
    this.unexpected(); // TODO inline declaration not supported
  }
  processingInstruction(): Tokenizer.ProcessingInstruction {
    this.input.next();
    let target = this.name();
    if (!target.length)
      this.unexpected();
    this.skipWhitespace();
    let data = this.text(false, [QUESTION, GT]);
    this.input.next();
    return {
      type: Tokenizer.TokenType.PROCESSING_INSTRUCTION_NODE,
      data,
      target
    };
  }
  startTag(): Tokenizer.Token {
    let code = this.input.get();
    if (!isNameChar(code))
      return {
        type: Tokenizer.TokenType.TEXT_NODE,
        data: '<'
      } as Tokenizer.CharacterData;
    let result: Tokenizer.StartTag = {
      type: Tokenizer.TokenType.ELEMENT_NODE,
      name: this.name(),
      attributes: [],
      opening: true,
      selfClosed: false
    };
    code = this.input.get();
    while (code !== EOF) {
      switch (code = this.skipWhitespace()) {
        case SLASH:
          if (this.input.next() !== GT)
            this.unexpected();
          result.selfClosed = true;
          // noinspection FallThroughInSwitchStatementJS
        case GT:
          this.input.next();
          return result;
        default:
          result.attributes.push(this.attribute());
      }
    }
    return result;
  }
  endTag(): Tokenizer.Tag {
    this.input.next();
    let result: Tokenizer.Tag = {
      type: Tokenizer.TokenType.ELEMENT_END_NODE,
      name: this.name(),
      opening: false
    };
    this.skipWhitespace();
    if (this.input.get() !== GT)
      this.unexpected();
    this.input.next();
    return result;
  }
  attribute(): Tokenizer.Attribute {
    let result: Tokenizer.Attribute = {
      name: this.name(),
      value: null
    };
    let code = this.skipWhitespace();
    if (code === EQ) {
      this.input.next();
      this.skipWhitespace();
      result.value = this.attributeValue();
    }
    return result;
  }
  attributeValue(): string {
    let code = this.input.get();
    switch (code) {
      case SINGLE_QUOTE:
      case DOUBLE_QUOTE:
        this.input.next();
        return this.quotedAttributeValue(code);
      case AMPERSAND:
        let entity = this.entity();
        if (entity.length === 1 && (entity[0] === SINGLE_QUOTE || entity[0] === DOUBLE_QUOTE))
          return this.quotedByEntityAttributeValue(entity[0]);
        return String.fromCodePoint(...entity) + this.unquotedAttributeValue();
      default:
        return this.unquotedAttributeValue();
    }
  }
  attributeValueOnlyStrict(): string {
    let code = this.input.get();
    switch (code) {
      case SINGLE_QUOTE:
      case DOUBLE_QUOTE:
        this.input.next();
        return this.quotedAttributeValue(code);
      default:
        this.unexpected();
    }
  }
  quotedAttributeValue(delimiter: number): string {
    let code = this.input.get();
    this.stringBuilder.clear();
    while (true) {
      // noinspection FallThroughInSwitchStatementJS
      switch (code) {
        case EOF:
          this.unexpected();
        case AMPERSAND:
          this.stringBuilder.appendSequence(this.entity());
          code = this.input.get();
          break;
        case delimiter:
          this.input.next();
          return this.stringBuilder.getString();
        default:
          this.stringBuilder.append(code);
          code = this.input.next();
      }
    }
  }
  quotedByEntityAttributeValue(delimiter: number): string {
    let code = this.input.get();
    this.stringBuilder.clear();
    while (true) {
      switch (code) {
        case EOF:
          this.unexpected();
          // noinspection FallThroughInSwitchStatementJS
        case AMPERSAND:
          let entity = this.entity();
          if (entity.length === 1 && entity[0] === delimiter)
            return this.stringBuilder.getString();
          this.stringBuilder.appendSequence(entity);
          code = this.input.get();
          break;
        default:
          this.stringBuilder.append(code);
          code = this.input.next();
      }
    }
  }
  unquotedAttributeValue(): string {
    this.stringBuilder.clear();
    let code = this.input.get();
    scan: while (code !== EOF) {
      switch (code) {
        case GT:
          break scan;
        case AMPERSAND:
          this.stringBuilder.appendSequence(this.entity());
          code = this.input.get();
          break;
        default:
          if (isSpace(code)) {
            break scan;
          } else {
            this.stringBuilder.append(code);
            code = this.input.next();
          }
      }
    }
    return this.stringBuilder.getString();
  }
  entity(): number[] {
    // noinspection FallThroughInSwitchStatementJS
    switch (this.input.next()) {
      case EOF:
        this.unexpected();
      case SEMICOLON:
        this.unexpected();
      case SHARP:
        return [this.entityCodePoint()];
      default:
        return this.entityNamed();
    }
  }
  entityCodePoint(): number {
    // noinspection FallThroughInSwitchStatementJS
    switch (this.input.next()) {
      case EOF:
        this.unexpected();
      case SEMICOLON:
        this.unexpected();
      case X_REGULAR:
      case X_CAPITAL:
        return this.entityCodePointRadix(16);
      default:
        return this.entityCodePointRadix(10);
    }
  }
  entityCodePointRadix(radix: number): number {
    let code = this.input.get();
    let entityCode = 0;
    while (true) {
      switch (code) {
        case EOF:
          this.unexpected();
          // noinspection FallThroughInSwitchStatementJS
        case SEMICOLON:
          this.input.next();
          return entityCode;
        default:
          let value = hexDigitToValue(code);
          if (isNaN(value))
            this.unexpected();
          if (value >= radix)
            this.unexpected();
          entityCode = entityCode * radix + value;
          if (entityCode > 0x10FFFF)
            this.unexpected();
          code = this.input.next();
      }
    }
  }
  entityNamed(): number[] {
    let name = this.name();
    if (this.input.get() !== SEMICOLON)
      this.unexpected();
    name = name.toLowerCase();
    return KNOWN_ENTITIES[name] || this.unexpected();
  }
  name(): string {
    return this.readName(true);
  }
  nameAnyFirst(): string {
    return this.readName(false);
  }
  readName(checkFirst: boolean) {
    let code = this.input.get();
    if (checkFirst && !isNameStartChar(code))
      this.unexpected();
    this.stringBuilder.clear();
    do {
      this.stringBuilder.append(code);
      code = this.input.next();
    } while (isNameChar(code));
    return this.stringBuilder.getString();
  }
  text(resolveEntities: boolean, stopSequence: number[]): string {
    this.stringBuilder.clear();
    if (this.appendUpTo(resolveEntities, stopSequence))
      return this.stringBuilder.getString(0, this.stringBuilder.position + 1 - stopSequence.length);
    else
      this.unexpected();
  }
  appendUpTo(resolveEntities: boolean, stopSequence: number[]): boolean {
    const indexes = Array(stopSequence.length);
    let code = this.input.get();
    let size = 0;
    while (code !== EOF) {
      if (code === AMPERSAND && resolveEntities) {
        this.stringBuilder.appendSequence(this.entity());
        size = 0;
        code = this.input.get();
      } else {
        indexes[size++] = 0;
        this.stringBuilder.append(code);
        let j = 0;
        for (let i = 0; i < size; ++i) {
          let index = indexes[i];
          if (stopSequence[index] === code) {
            if ((indexes[j++] = ++index) === stopSequence.length) {
              return true;
            }
          }
        }
        size = j;
        code = this.input.next();
      }
    }
    return false;
  }
  skipWhitespace(mandatory = false): number {
    let code = this.input.get();
    if (mandatory) {
      if (!isSpace(code))
        this.unexpected();
      code = this.input.next();
    }
    while (code !== EOF && isSpace(code))
      code = this.input.next();
    return code;
  }
  delimitedChars(goodStart: number[], goodEnd: number[], badEnd: number[]): string {
    this.stringBuilder.clear();
    let wellFormedStart = this.assertSequence(goodStart, true);
    if (wellFormedStart)
      this.stringBuilder.clear();
    if (this.appendUpTo(false, wellFormedStart ? goodEnd : badEnd))
      this.input.next();
    else
      return this.stringBuilder.getString();
    return this.stringBuilder.getString(0, this.stringBuilder.position - (wellFormedStart ? goodEnd : badEnd).length + 1);
  }
  assertSequence(seq: number[], append: boolean = true): boolean {
    let actual = this.input.get();
    for (let expected of seq) {
      if (expected !== actual) return false;
      if (append)
        this.stringBuilder.append(expected);
      actual = this.input.next();
    }
    return true;
  }
  unexpected(): never {
    throw new Error();
  }
}
