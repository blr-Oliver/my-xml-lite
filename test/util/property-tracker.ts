export const trackProperty: <O extends object, K extends keyof O>(target: O, property: K) => (O[K])[]
    = <O extends object, K extends keyof O>(target: O, property: K) => {
  const values: (O[K])[] = [];
  const originalDescriptor =
      property in target ?
          Object.getOwnPropertyDescriptor(getClosestPrototypeWithProperty(target, property), property)!
          : undefined;
  const trackingDescriptor = buildTrackingDescriptor(target, property, values, originalDescriptor);
  Object.defineProperty(target, property, trackingDescriptor);
  return values;

  function getClosestPrototypeWithProperty(target: O, property: K): object {
    while (!target.hasOwnProperty(property))
      target = Object.getPrototypeOf(target);
    return target;
  }

  function buildTrackingDescriptor(target: O, property: K, values: (O[K])[], originalDescriptor?: PropertyDescriptor): PropertyDescriptor {
    const originalGet: (() => (O[K])) | undefined = originalDescriptor?.get;
    const originalSet: ((value: (O[K])) => void) | undefined = originalDescriptor?.set;
    const result: PropertyDescriptor = {
      configurable: originalDescriptor ? originalDescriptor.configurable : true,
      enumerable: originalDescriptor ? originalDescriptor.enumerable : true
    }
    if (originalSet) {
      result.get = originalGet;
      result.set = (value: (O[K])) => {
        values.push(value);
        originalSet.call(target, value);
      }
    } else {
      const holder: O = Object.create(target);
      holder[property] = target[property];
      if (originalGet)
        result.get = () => originalGet.call(holder);
      else
        result.get = () => holder[property];
      result.set = (value: (O[K])) => {
        values.push(value);
        holder[property] = value;
      }
    }
    return result;
  }
};
