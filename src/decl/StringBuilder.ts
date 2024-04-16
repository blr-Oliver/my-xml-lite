export interface StringBuilder {
  readonly buffer: ArrayLike<number>;
  position: number;
  clear(): void;
  append(code: number): void;
  appendSequence(seq: number[]): void;
  getString(from?: number, to?: number): string;
  /**
   * Gets contents as string AND immediately clears the buffer
   */
  takeString(from?: number, to?: number): string;
  getCodes(from?: number, to?: number): number[];
}