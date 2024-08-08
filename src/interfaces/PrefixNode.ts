export interface PrefixNode<T> {
  value?: T;
  children?: { [next: number]: PrefixNode<T> };
}