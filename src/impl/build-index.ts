import {stringToArray} from '../common/code-sequences';
import {PrefixNode} from '../decl/entity-ref-index';
import {EntityMapping} from '../decl/known-named-refs';

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