export function less () {
  return {
    id: 'math/less',
    version: '0.2.1',
    inputPorts: {
      isLess: 'number',
      than: 'number'
    },
    outputPorts: {
      value: 'bool'
    },
    atomic: true,
    settings: {
      argumentOrdering: [
        'isLess',
        'than',
        'value'
      ]
    }
  }
}
