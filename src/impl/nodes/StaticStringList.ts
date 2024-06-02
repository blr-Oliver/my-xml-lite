import {StringList} from '../../decl/xml-lite-decl';

// TODO replace array inheritance with DOMTokenList
export class StaticStringList extends Array<string> implements StringList {
  readonly flags: { [name: string]: true };

  constructor(list: string) {
    super(...list.split(/\s+/));
    const flags: { [name: string]: true } = this.flags = {};
    for (let value of this)
      flags[value] = true;
  }

  contains(string: string): boolean {
    return string in this.flags;
  }
}