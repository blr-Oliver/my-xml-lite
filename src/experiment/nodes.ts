interface A {
  readonly a: number;
}

interface B extends A {
  a: number;
}

class C implements B {
  a: number;
  constructor() {
    this.a = 0;
  }
}

class D implements A {
  a: number;
  constructor() {
    this.a = 0;
  }
}

let a: A = new C();
let b: B = new C();

b = a;
b.a = 1;
