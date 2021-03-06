export function first () {
  return {
    id: 'array/first',
    version: '0.2.0',
    inputPorts: {
      array: '[generic]'
    },
    outputPorts: {
      value: 'generic'
    },
    atomic: true,
    settings: {
      argumentOrdering: [
        'array',
        'value'
      ]
    }
  }
}

export function rest () {
  return {
    id: 'array/rest',
    version: '0.2.0',
    inputPorts: {
      array: 'generic'
    },
    outputPorts: {
      rest: 'generic'
    },
    atomic: true,
    settings: {
      argumentOrdering: [
        'array',
        'rest'
      ]
    }
  }
}

export function empty () {
  return {
    id: 'array/empty',
    version: '0.2.0',
    inputPorts: {
      array: 'generic'
    },
    outputPorts: {
      isEmpty: 'bool'
    },
    atomic: true,
    settings: {
      argumentOrdering: [
        'array',
        'isEmpty'
      ]
    }
  }
}

export function concat () {
  return {
    id: 'array/concat',
    version: '0.2.0',
    inputPorts: {
      array1: 'generic',
      array2: 'generic'
    },
    outputPorts: {
      result: 'generic'
    },
    atomic: true,
    settings: {
      argumentOrdering: [
        'array1',
        'array2',
        'result'
      ]
    }
  }
}
