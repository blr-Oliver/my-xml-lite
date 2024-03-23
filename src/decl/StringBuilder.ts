export interface StringBuilder {
  readonly buffer: ArrayLike<number>;
  position: number;
  clear(): void;
  append(code: number): void;
  appendSequence(seq: number[]): void;
  buildString(from?: number, to?: number): string;
}