import _ from 'lodash'
import { atomicPredecessorsOutPort } from '../util/atomicWalk'

export function any (outputAlias) {
  return (graph, n) => {
    return { node: graph.node(n) }
  }
}

export function oneOf (...rules) {
  return (graph, n) => {
    for (let i = 0; i < rules.length; i++) {
      let match = rules[i](graph, n)
      if (match !== false) {
        return match
      }
    }
    return false
  }
}

export function byIdAndInputs (id, inputs = {}) {
  return (graph, n) => {
    const node = graph.node(n)
    if (node.id === id) {
      const match = { node: n, inputs: {} }
      const isMatch = Object.keys(inputs).every((inputPort) => {
        let predecessors = atomicPredecessorsOutPort(graph, n, inputPort)
        if (predecessors.length === 1) {
          return predecessors.every(({node, port}) => {
            let inputMatcher = inputs[inputPort]
            if (_.isFunction(inputMatcher)) {
              match.inputs[inputPort] = inputs[inputPort](graph, node)
              return match.inputs[inputPort] !== false
            } else {
              match.inputs[inputMatcher.alias || inputPort] = inputMatcher.match(graph, node)
              return match.inputs[inputMatcher.alias || inputPort] !== false
            }
          })
        } else {
          return false
        }
      })
      return isMatch ? match : false
    } else {
      return false
    }
  }
}

export function constantNode (value, outputAlias) {
  return (graph, n) => {
    const node = graph.node(n)
    if (node.id === 'math/const') {
      const match = { node: n, outputs: {} }
      match.outputs[outputAlias || Object.keys(node.outputPorts)[0]] = Object.keys(node.outputPorts)[0]

      if (_.isNumber(value)) {
        return value === node.params.value ? match : false
      } else {
        return match
      }
    } else {
      return false
    }
  }
}
