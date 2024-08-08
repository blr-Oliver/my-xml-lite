export function stringToArray(s: string): number[] {
  return [...s].map(c => c.codePointAt(0)!);
}