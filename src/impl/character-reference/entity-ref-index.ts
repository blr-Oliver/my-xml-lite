import {stringToArray} from '../../common/code-points';
import {EntityMapping} from '../../decl/known-named-refs';

export const CHAR_REF_REPLACEMENT: number[] = [
  0x20AC, 0x0000, 0x201A, 0x0192, 0x201E, 0x2026, 0x2020, 0x2021,
  0x02C6, 0x2030, 0x0160, 0x2039, 0x0152, 0x0000, 0x017D, 0x0000,
  0x0000, 0x2018, 0x2019, 0x201C, 0x201D, 0x2022, 0x2013, 0x2014,
  0x02DC, 0x2122, 0x0161, 0x203A, 0x0153, 0x0000, 0x017E, 0x0178
] as const;

export interface PrefixNode<T> {
  value?: T;
  children?: { [next: number]: PrefixNode<T> };
}

type DecodedEntity<T> = {
  name: number[];
  value: T;
}

export function buildIndex<T>(mapping: EntityMapping<T>): PrefixNode<T> {
  const entities: DecodedEntity<T>[] = [];
  for (let entity in mapping)
    entities.push({
      name: stringToArray(entity),
      value: mapping[entity]
    });
  entities.sort(({name: a}, {name: b}) => {
    const l = Math.min(a.length, b.length);
    for (let i = 0; i < l; ++i)
      if (a[i] !== b[i]) return a[i] - b[i];
    return l < a.length ? 1 : (l < b.length ? -1 : 0);
  });
  return entities.length ? collectNodes(entities, 0, entities.length, 0) : {};
}

function collectNodes<T>(entities: DecodedEntity<T>[], lo: number, hi: number, position: number): PrefixNode<T> {
  let node: PrefixNode<T> = {};
  if (entities[lo].name.length === position) {
    node.value = entities[lo++].value;
    if (lo >= hi) return node;
  }
  node.children = {};
  let from = lo;
  let lastCode = entities[lo].name[position];
  for (let i = from + 1; i < hi; ++i) {
    let code = entities[i].name[position];
    if (code !== lastCode) {
      node.children[lastCode] = collectNodes(entities, from, i, position + 1);
      lastCode = code;
      from = i;
    }
  }
  if (from < hi)
    node.children[lastCode] = collectNodes(entities, from, hi, position + 1);
  return node;
}
