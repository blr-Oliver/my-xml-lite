import {CharacterSource} from '../../interfaces/CharacterSource.js';
import {CodePoints} from '../../interfaces/CodePoints.js';

export class UTF8BufferSentinelSource implements CharacterSource {
  data: Buffer;
  position: number;

  constructor(buffer: Buffer, position: number = 0) {
    this.data = buffer;
    this.position = position;
  }

  next(): number {
    const byte1 = this.data[this.position++];
    switch (Math.clz32(~byte1 & 0xFF)) {
      case 24: // ASCII, single byte, 0x00-0x7F
        return byte1;
      case 25: // non-conforming, single byte, 0x00-0x3F
        return byte1 & 0x3F;
      case 26: // 2 bytes for code point, 0x0080-0x07FF
        return ((byte1 & 0x1F) << 6) | (this.data[this.position++] & 0x3F);
      case 27: // 3 bytes for code point, 0x0800-0xFFFF
        return ((byte1 & 0x0F) << 12) | ((this.data[this.position++] & 0x3F) << 6) | (this.data[this.position++] & 0x3F);
      case 28: // multilingual planes, 4 bytes for code point, 0x010000-0x10FFFF
        return ((byte1 & 0x07) << 18) | ((this.data[this.position++] & 0x3F) << 12) | ((this.data[this.position++] & 0x3F) << 6) | (this.data[this.position++] & 0x3F);
      case 29: // non-conforming, may result in non valid code point, 5 bytes sequence
        return ((byte1 & 0x03) << 24) | ((this.data[this.position++] & 0x3F) << 18) | ((this.data[this.position++] & 0x3F) << 12) | ((this.data[this.position++] & 0x3F) << 6) | (this.data[this.position++] & 0x3F);
      case 30: // non-conforming, may result in non valid code point, 6 bytes sequence
        return ((byte1 & 0x01) << 30) | ((this.data[this.position++] & 0x3F) << 24) | ((this.data[this.position++] & 0x3F) << 18) | ((this.data[this.position++] & 0x3F) << 12) | ((this.data[this.position++] & 0x3F) << 6) | (this.data[this.position++] & 0x3F);
      case 31:
        return CodePoints.EOC;
      default:
        return CodePoints.EOF;
    }
  }
}