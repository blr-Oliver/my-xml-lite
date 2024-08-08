import {Document} from '../interfaces/dom-types.js';
import {HTML_SPECIAL} from '../interfaces/named-character-refs.js';
import {StringCharacterSource} from './input/StringCharacterSource.js';
import {SimpleNodeFactory} from './simple-tree/SimpleNodeFactory.js';
import {Tokenizer} from './Tokenizer.js';
import {TreeComposer} from './TreeComposer.js';
import {buildIndex} from './util/build-index.js';

export function parseFromString(html: string): Document {
  const source = new StringCharacterSource(html);
  const factory = new SimpleNodeFactory();
  const tokenizer = new Tokenizer(buildIndex(HTML_SPECIAL));
  const composer = new TreeComposer(factory);
  tokenizer.composer = composer;
  composer.tokenizer = tokenizer;
  tokenizer.input = source;
  tokenizer.reset();
  composer.reset();
  tokenizer.proceed();
  return composer.document;
}