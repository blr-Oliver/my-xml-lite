export interface CharacterSource {
  /**
   * @return next valid Unicode code point (including characters outside BMP) or -1 if the source is exhausted
   * or -2 if no more characters are available at the moment
   */
  next(): number;
}

export interface Resettable {
  reset(): void;
}