import {Document} from '../decl/dom-like.js';
import {HTML_SPECIAL} from '../decl/known-named-refs.js';
import {buildIndex} from './build-index.js';
import {StringCharacterSource} from './input/StringCharacterSource.js';
import {SimpleNodeFactory} from './simple-tree/SimpleNodeFactory.js';
import {Tokenizer} from './Tokenizer.js';
import {TreeComposer} from './TreeComposer.js';

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