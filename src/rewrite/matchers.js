import _ from 'lodash'
import { walk } from '@buggyorg/graphtools'

export function any (outputAlias) {
  return (graph, node) => {
    return { node }
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

      if (_.isArray(inputs)) {
        match.inputs = []
        let inputPortsLeft = Object.keys(node.inputPorts)

        const isMatch = inputs.every((inputMatcher, index) => {
          const matchingPort = inputPortsLeft.find((inputPort) => {
            let predecessors = walk.predecessor(graph, n, inputPort)
            if (predecessors.length === 1) {
              const tryMatchPredecessor = ({node, port}) => {
                if (_.isFunction(inputMatcher)) {
                  const inputMatch = inputMatcher(graph, node)
                  if (inputMatch !== false) {
                    match.inputs[index] = inputMatch
                    match.inputs[index].port = inputPort
                    return true
                  } else {
                    return false
                  }
                } else {
                  const inputMatch = inputMatcher.match(graph, node)
                  if (inputMatch !== false) {
                    match.inputs[inputMatcher.alias || index] = inputMatch
                    match.inputs[inputMatcher.alias || index].port = inputPort
                    return true
                  } else {
                    return false
                  }
                }
              }

              const predecessorMatches = predecessors.every(tryMatchPredecessor)
              if (predecessorMatches) {
                return true
              } else {
                while (!graph.node(predecessors[0].node).atomic) {
                  predecessors = walk.predecessor(graph, predecessors[0].node, predecessors[0].port)
                  if (predecessors.length === 1) {
                    if (predecessors.every(tryMatchPredecessor)) {
                      return true
                    }
                  } else {
                    return false
                  }
                }
                return false
              }
            } else {
              return false
            }
          })

          if (typeof matchingPort !== 'undefined') {
            inputPortsLeft = inputPortsLeft.filter((p) => p !== matchingPort)
            return true
          } else {
            return false
          }
        })
        return isMatch ? match : false
      } else {
        const isMatch = Object.keys(inputs).every((inputPort) => {
          let predecessors = walk.predecessor(graph, n, inputPort)
          if (predecessors.length === 1) {
            const tryMatchPredecessor = ({node, port}) => {
              let inputMatcher = inputs[inputPort]
              if (_.isFunction(inputMatcher)) {
                const inputMatch = inputMatcher(graph, node)
                if (inputMatch !== false) {
                  match.inputs[inputPort] = inputMatch
                  match.inputs[inputPort].port = inputPort
                  return true
                } else {
                  return false
                }
              } else {
                const inputMatch = inputMatcher.match(graph, node)
                if (inputMatch !== false) {
                  match.inputs[inputMatcher.alias || inputPort] = inputMatch
                  match.inputs[inputMatcher.alias || inputPort].port = inputPort
                  return true
                } else {
                  return false
                }
              }
            }
            const predecessorMatches = predecessors.every(tryMatchPredecessor)
            if (predecessorMatches) {
              return true
            } else {
              while (!graph.node(predecessors[0].node).atomic) {
                predecessors = walk.predecessor(graph, predecessors[0].node, predecessors[0].port)
                if (predecessors.length === 1) {
                  if (predecessors.every(tryMatchPredecessor)) {
                    return true
                  }
                } else {
                  return false
                }
              }
              return false
            }
          } else {
            return false
          }
        })
        return isMatch ? match : false
      }
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
      } else if (_.isBoolean(value)) {
        return value === node.params.value ? match : false
      } else {
        return match
      }
    } else {
      return false
    }
  }
}

export function lambda (options) {
  return (graph, n) => {
    const node = graph.node(n)

    if (node.id === 'functional/lambda') {
      if (typeof options.recursive !== 'undefined') {
        if ((options.recursive && !node.recursive) ||
            (!options.recursive && node.recursive)) {
          return false
        }
      }
      if (typeof options.sideeffects !== 'undefined') {
        if ((options.sideeffects && !node.sideeffects) ||
            (!options.sideeffects && node.sideeffects)) {
          return false
        }
      }
      return { node: n }
    }
    return false
  }
}

export function sink (matcher = any()) {
  return (graph, node) => {
    if (graph.successors(node).length === 0) {
      return matcher(graph, node)
    }
    return false
  }
}

export function alias (alias, match) {
  return { match, alias }
}
