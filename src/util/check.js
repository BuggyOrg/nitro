/**
 * Check if all given values are equal.
 * @param values values to check
 * @returns true if all given values are equal, false if not
 */
export function allEqual (...values) {
  return values.length === 0 || values.every((v) => v === values[0])
}
