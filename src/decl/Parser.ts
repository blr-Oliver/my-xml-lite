import {CharacterSource} from '../common/stream-source.js';
import {Document} from './dom-like.js';

export interface Parser {
  readonly active: boolean;
  readonly paused: boolean;
  readonly document: Document;

  reset(input?: CharacterSource): void;
  proceed(): boolean;
}
