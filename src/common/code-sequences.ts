export function stringToArray(s: string): number[] {
  return [...s].map(c => c.codePointAt(0)!);
}
export const CMT_START = stringToArray('<!--');
export const CMT_END = stringToArray('-->');
export const CD_START = stringToArray('<![CDATA[');
export const CD_END = stringToArray(']]>');
export const PI_START = stringToArray('<?');
export const PI_END = stringToArray('?>');