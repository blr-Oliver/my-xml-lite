import {CharacterSource} from './CharacterSource.js';
import {Document} from './dom-types.js';

export interface Parser {
  readonly active: boolean;
  readonly paused: boolean;
  readonly document: Document;

  reset(input?: CharacterSource): void;
  proceed(): boolean;
}
