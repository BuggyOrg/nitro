/**
 * Walks through the given object until predicate returns true. The step function is
 * called to get the next object. When predicate returns true, he last object is returned.
 * @export
 * @param {any} obj
 * @param {any} predicate
 * @param {any} step
 * @returns
*/
export function findDeep (obj, predicate, step) {
  if (predicate(obj)) {
    return obj
  } else {
    while (obj != null && !predicate(obj)) {
      obj = step(obj)
      if (predicate(obj)) {
        return obj
      }
    }
    return undefined
  }
}
