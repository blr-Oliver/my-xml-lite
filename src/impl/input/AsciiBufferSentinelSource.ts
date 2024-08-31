import {CharacterSource} from '../../interfaces/CharacterSource.js';

export class AsciiBufferSentinelSource implements CharacterSource {
  buffer: Buffer;
  position: number;

  constructor(buffer: Buffer) {
    this.buffer = buffer;
    this.position = 0;
  }

  next(): number {
    return this.buffer.readInt8(this.position++);
  }
}