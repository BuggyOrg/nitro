export function allEqual (...values) {
  return values.length === 0 || values.every((v) => v === values[0])
}
