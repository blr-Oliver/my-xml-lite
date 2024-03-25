import {ParserInterface} from './ParserInterface';

export interface CharacterReferenceParser {
  parse(input: ParserInterface, isAttribute: boolean): void;
}
