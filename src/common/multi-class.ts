export type Class<T = unknown> = {
  new(...args: any[]): T;
  prototype: T;
}
export function combine<A, B>(name: string, a: Class<A>, b: Class<B>): Class<A & B>;
export function combine<A, B, C>(name: string, a: Class<A>, b: Class<B>, c: Class<C>): Class<A & B & C>;
export function combine<A, B, C, D>(name: string, a: Class<A>, b: Class<B>, c: Class<C>, d: Class<D>): Class<A & B & C & D>;
export function combine<A, B, C, D, E>(name: string, a: Class<A>, b: Class<B>, c: Class<C>, d: Class<D>, e: Class<E>): Class<A & B & C & D & E>;
export function combine<A, B, C, D, E, F>(name: string, a: Class<A>, b: Class<B>, c: Class<C>, d: Class<D>, e: Class<E>, f: Class<F>): Class<A & B & C & D & E & F>;
export function combine(name: string, ...classes: Class[]): Class;
export function combine(name: string, ...classes: Class[]): Class {
  const result = {
    [name]: function () {
    }
  }[name] as unknown as Class;
  const proto: any = result.prototype = {};
  proto.constructor = result;
  for (let clazz of classes) {
    const classProto: any = clazz.prototype;
    if (classProto) {
      let keys = Object.getOwnPropertyNames(classProto);
      for (let key of keys) {
        if (key === 'constructor') continue;
        const descriptor = Object.getOwnPropertyDescriptor(classProto, key)!;
        if (descriptor.get || descriptor.set) {
          Object.defineProperty(proto, key, descriptor);
        } else {
          const member = classProto[key];
          if (typeof member === 'function')
            proto[key] = member;
        }
      }
    }
  }
  return result;
}