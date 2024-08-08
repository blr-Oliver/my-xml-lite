type Writable<T, P extends keyof T = keyof T> = {
  [K in keyof T as K extends P ? never : K]: T[K];
} & {
  -readonly [K in P]: T[K];
}

export interface StringBuilder {
  readonly buffer: Writable<ArrayLike<number>, number>;
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