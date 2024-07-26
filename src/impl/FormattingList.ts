/*
getLastFormattingElementForName
get by index
get index for element
replace at index
insert after specific element
remove specific element
remove at index
clear zone
add zone
check if contains element
get original token
reset
*/
import {Element} from '../decl/xml-lite-decl';
import {TagToken} from './interfaces/tokens';

export interface FormattingElement {
  element: Element;
  token: TagToken;
  fastKey: string;
  slowKey?: string;
  previous?: FormattingElement;
  next?: FormattingElement;
}

type OptimisticFastStats = {
  count: number;
  pessimistic: false;
  nodes: FormattingElement[];
};
type PessimisticFastStats = {
  count: number;
  pessimistic: true;
};
type FastStats = OptimisticFastStats | PessimisticFastStats;

type FormattingZone = {
  head: FormattingElement | undefined,
  tail: FormattingElement | undefined,
  fastMap: Map<string, FastStats>,
  slowMap: Map<string, FormattingElement[]>
}

export class FormattingList {
  head?: FormattingElement;
  tail?: FormattingElement;
  private fastMap: Map<string, FastStats> = new Map<string, FastStats>();
  private slowMap: Map<string, FormattingElement[]> = new Map<string, FormattingElement[]>();
  private zones: FormattingZone[] = [];

  private buildFastKey(element: Element): string {
    return `${element.tagName}\u0000${element.attributes.length}`;
  }

  private buildSlowKey(element: Element): string {
    return '';// TODO
  }

  private switchToPessimistic(fastKey: string, stats: OptimisticFastStats) {
    const count = stats.count;
    for (let i = 0; i < count; ++i) {
      const node = stats.nodes[i];
      if (!node.slowKey) {
        const slowKey = node.slowKey = this.buildSlowKey(node.element);
        let slowList = this.slowMap.get(slowKey);
        if (!slowList)
          this.slowMap.set(slowKey, slowList = []);
        slowList.push(node);
      }
    }
    this.fastMap.set(fastKey, {
      count: stats.count,
      pessimistic: true
    });
  }

  add(element: Element, token: TagToken): FormattingElement {
    const fastKey = this.buildFastKey(element);
    const stats = this.fastMap.get(fastKey);
    if (!stats) {
      const node = this.doAdd(element, token, fastKey, undefined);
      this.fastMap.set(fastKey, {
        count: 1,
        pessimistic: false,
        nodes: [node]
      });
      return node;
    } else if (!stats.pessimistic) {
      if (stats.count < 3) {
        const node = this.doAdd(element, token, fastKey, undefined);
        stats.nodes.push(node);
        stats.count++;
        return node;
      } else
        this.switchToPessimistic(fastKey, stats);
    }
    const slowKey = this.buildSlowKey(element);
    const slowList = this.slowMap.get(slowKey);
    if (!slowList) {
      const node = this.doAdd(element, token, fastKey, slowKey);
      stats.count++;
      this.slowMap.set(slowKey, [node]);
      return node;
    } else if (slowList.length < 3) {
      const node = this.doAdd(element, token, fastKey, slowKey);
      stats.count++;
      slowList.push(node);
      return node;
    } else {
      // its length must be 3 now
      this.doRemove(slowList[0]);
      slowList.copyWithin(0, 1);
      return slowList[2] = this.doAdd(element, token, fastKey, slowKey);
    }
  }

  private doAdd(element: Element, token: TagToken, fastKey: string, slowKey: string | undefined): FormattingElement {
    if (!this.tail) {
      return this.head = this.tail = {
        element,
        token,
        fastKey,
        slowKey,
        previous: undefined,
        next: undefined
      };
    } else {
      return this.tail = this.tail.next = {
        element,
        token,
        fastKey,
        slowKey,
        previous: this.tail,
        next: undefined
      };
    }
  }

  remove(formattingElement: FormattingElement): void {
    this.fastMap.get(formattingElement.fastKey)!.count--;
    const slowKey = formattingElement.slowKey;
    if (slowKey) {
      const slowList = this.slowMap.get(slowKey)!;
      if (slowList[slowList.length - 1] === formattingElement)
        slowList.pop();
      else if (slowList[0] === formattingElement)
        slowList.shift();
      else
        slowList.splice(1, 1);
    }
    this.doRemove(formattingElement);
  }

  private doRemove(formattingElement: FormattingElement) {
    if (formattingElement.previous)
      formattingElement.previous.next = formattingElement.next;
    else if (this.head === formattingElement)
      this.head = formattingElement.next;
    if (formattingElement.next)
      formattingElement.next.previous = formattingElement.previous;
    else if (this.tail === formattingElement)
      this.tail = formattingElement.previous;
  }

  /*
  insertAfter(element: Element, token: TagToken, after: FormattingElement): FormattingElement {
    if (after) {
      if (after.next)
        return after.next = after.next.previous = {element, token, previous: after, next: after.next};
      else
        return this.tail = after.next = {element, token, previous: after, next: undefined};
    } else {
      if (this.head)
        return this.head = this.head.previous = {element, token, previous: undefined, next: this.head};
      else
        return this.head = this.tail = {element, token, previous: undefined, next: undefined};
    }
  }
   */

  private doInsertAfter(element: Element, token: TagToken, after: FormattingElement, fastKey: string, slowKey: string | undefined) {

  }

  addMarker() {
    this.zones.push({
      head: this.head,
      tail: this.tail,
      fastMap: this.fastMap,
      slowMap: this.slowMap
    });
    this.head = this.tail = undefined;
    this.fastMap = new Map<string, FastStats>();
    this.slowMap = new Map<string, FormattingElement[]>();
  }

  clearToMarker() {
    const zone = this.zones.pop()!;
    this.head = zone.head;
    this.tail = zone.tail;
    this.fastMap = zone.fastMap;
    this.slowMap = zone.slowMap;
  }

  reset() {
    this.tail = this.head = undefined;
    this.fastMap.clear();
    this.slowMap.clear();
    this.zones.length = 0;
  }
}
