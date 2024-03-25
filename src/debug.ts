import {stringToArray} from './common/code-points';
import {DirectCharacterSource} from './common/stream-source';
import {HTML_SPECIAL} from './decl/known-named-refs';
import {buildIndex} from './impl/character-reference/entity-ref-index';
import {StateBasedRefParser} from './impl/character-reference/StateBasedRefParser';
import {FixedSizeStringBuilder} from './impl/FixedSizeStringBuilder';

export function setChars(buffer: DirectCharacterSource, chars: string, offset: number = 0) {
  let src = stringToArray(chars);
  let dest = buffer.getData();
  for (let i = 0, j = offset; i < src.length; ++i)
    dest[j++] = src[i];
  buffer.setLimit(offset + src.length);
}

async function peek() {
  let parser = new StateBasedRefParser(buildIndex(HTML_SPECIAL));
  let input = new DirectCharacterSource(new Uint16Array(1 << 10));
  input.reset();
  setChars(input, '#x2ffff;');
  const buffer = new FixedSizeStringBuilder(64);
  parser.parse({
    input,
    buffer,
    errors: [],
    reconsume: false
  }, true);
}

async function keypress(): Promise<void> {
  process.stdin.setRawMode(true);

  return new Promise(resolve => {
    process.stdin.once('data', () => {
      process.stdin.setRawMode(false);
      resolve();
    });
  });
}

keypress().then(() => peek());