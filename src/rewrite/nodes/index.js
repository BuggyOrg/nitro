export function constantBool (value) {
  return {
    id: 'std/const',
    version: '0.2.0',
    inputPorts: {},
    outputPorts: { output: 'bool' },
    atomic: true,
    path: [],
    params: { value },
    name: 'const',
    settings: {
      argumentOrdering: [ 'output' ]
    }
  }
}

export function constantNumber (value) {
  return {
    id: 'std/const',
    version: '0.2.0',
    inputPorts: {},
    outputPorts: { output: 'number' },
    atomic: true,
    path: [],
    params: { value },
    name: 'const',
    settings: {
      argumentOrdering: [ 'output' ]
    }
  }
}

export function constantString (value) {
  return {
    id: 'std/const',
    version: '0.2.0',
    inputPorts: {},
    outputPorts: { output: 'string' },
    atomic: true,
    path: [],
    params: { value },
    name: 'const',
    settings: {
      argumentOrdering: [ 'output' ]
    }
  }
}

export function lambda () {
  return {
    id: 'functional/lambda',
    version: '0.2.0',
    atomic: true,
    outputPorts: { fn: 'function' },
    settings: {
      argumentOrdering: [ 'fn' ]
    }
  }
}

export function call () {
  return {
    id: 'functional/call',
    version: '0.2.0',
    inputPorts: {
      fn: 'function'
    },
    outputPorts: {
      result: 'function:return'
    },
    atomic: true,
    specialForm: true,
    settings: {
      argumentOrdering: [
        'fn',
        'result'
      ]
    }
  }
}

export function partial (parameterIndex = 0) {
  return {
    id: 'functional/partial',
    version: '0.2.1',
    inputPorts: {
      fn: 'function',
      value: 'function:arg'
    },
    outputPorts: {
      result: 'function:partial'
    },
    atomic: true,
    specialForm: true,
    settings: {
      argumentOrdering: [
        'fn',
        'value',
        'result'
      ]
    },
    params: {
      partial: parameterIndex
    }
  }
}

export function arrayFirst () {
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

export function logicNot () {
  return {
    id: 'logic/not',
    version: '0.2.0',
    inputPorts: {
      input: 'bool'
    },
    outputPorts: {
      output: 'bool'
    },
    atomic: true,
    settings: {
      argumentOrdering: [
        'input',
        'output'
      ]
    }
  }
}

export function logicMux () {
  return {
    id: 'logic/mux',
    inputPorts: {
      input1: 'generic',
      input2: 'generic',
      control: 'bool'
    },
    outputPorts: {
      output: 'generic'
    },
    atomic: true,
    version: '0.3.0',
    specialForm: true,
    settings: {
      argumentOrdering: ['input1', 'input2', 'control', 'output']
    }
  }
}

export function multiply () {
  return {
    id: 'math/multiply',
    inputPorts: {
      m1: 'number',
      m2: 'number'
    },
    outputPorts: {
      product: 'number'
    },
    atomic: true,
    version: '0.3.0',
    settings: {
      argumentOrdering: ['m1', 'm2', 'product']
    }
  }
}
