import {stringToArray} from './common/code-points';
import {HTML_SPECIAL} from './common/known-named-refs';
import {DirectCharacterSource} from './common/stream-source';
import {buildIndex} from './impl/entity-ref-index';
import {FixedSizeStringBuilder} from './impl/FixedSizeStringBuilder';
import {StateBasedRefParser} from './impl/StateBasedRefParser';

export function setChars(buffer: DirectCharacterSource, chars: string, offset: number = 0) {
  let src = stringToArray(chars);
  let dest = buffer.getData();
  for (let i = 0, j = offset; i < src.length; ++i)
    dest[j++] = src[i];
  buffer.setLimit(offset + src.length);
}

async function peek() {
  debugger;
  let parser = new StateBasedRefParser(buildIndex(HTML_SPECIAL), new FixedSizeStringBuilder(32));
  let input = new DirectCharacterSource(new Uint16Array(1 << 10));
  input.reset();
  setChars(input, '#97;');
  parser.parse(input, true);
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