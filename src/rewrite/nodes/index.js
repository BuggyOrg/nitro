export function constantBool (value) {
  return {
    id: 'math/const',
    version: '0.2.0',
    inputPorts: {},
    outputPorts: { output: 'bool' },
    atomic: true,
    path: [],
    params: { value },
    name: 'const'
  }
}
