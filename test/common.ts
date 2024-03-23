import {stringToArray} from '../src/common/code-points';
import {DirectCharacterSource} from '../src/common/stream-source';

export function charSourceFromString(chars: string): DirectCharacterSource {
  return new DirectCharacterSource(new Uint16Array(stringToArray(chars)));
}

export function setChars(buffer: DirectCharacterSource, chars: string, offset: number = 0) {
  let src = stringToArray(chars);
  let dest = buffer.getData();
  for (let i = 0, j = offset; i < src.length; ++i)
    dest[j++] = src[i];
  buffer.setLimit(offset + src.length);
}