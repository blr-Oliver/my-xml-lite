import {ParserEnvironment} from './ParserEnvironment';

export interface CharacterReferenceParser {
  parse(input: ParserEnvironment, isAttribute: boolean): void;
}
