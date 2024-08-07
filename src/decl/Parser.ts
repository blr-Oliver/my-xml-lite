import {CharacterSource} from '../common/stream-source.js';
import {ErrorHandler} from '../impl/interfaces/error-tracker.js';
import {Document} from './dom-like.js';

export interface Parser {
  readonly active: boolean;
  readonly paused: boolean;
  readonly document: Document;
  errorHandler: ErrorHandler;

  reset(input: CharacterSource): void;
  proceed(): boolean;
}
