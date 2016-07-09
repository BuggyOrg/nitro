import _ from 'lodash'
import { walk } from '@buggyorg/graphtools'
import { realPredecessors } from '../util/realWalk'
import { atomicSuccessorsInPort } from '../util/atomicWalk'

export function any (options = {}) {
  return (graph, node, port) => {
    if (options.requireNode === false || graph.hasNode(node)) {
      return { node, inPort: port }
    }
    return false
  }
}

export function oneOf (...rules) {
  return (graph, n, port) => {
    for (let i = 0; i < rules.length; i++) {
      let match = rules[i](graph, n, port)
      if (match !== false) {
        return match
      }
    }
    return false
  }
}

export function byIdAndInputs (id, inputs = {}) {
  return (graph, n, port) => {
    const node = graph.node(n)
    if (node && node.id === id) {
      const match = { node: n, inputs: {}, inPort: port }

      if (_.isArray(inputs)) {
        match.inputs = []
        let inputPortsLeft = Object.keys(node.inputPorts)

        const isMatch = inputs.every((inputMatcher, index) => {
          const matchingPort = inputPortsLeft.find((inputPort) => {
            let predecessors = realPredecessors(graph, n, inputPort)
            const tryMatchPredecessor = ({node, port}) => {
              if (_.isFunction(inputMatcher)) {
                const inputMatch = inputMatcher(graph, node, port)
                if (inputMatch !== false) {
                  match.inputs[index] = inputMatch
                  match.inputs[index].port = inputPort
                  match.inputs[index].inPort = port
                  return true
                } else {
                  return false
                }
              } else {
                const inputMatch = inputMatcher.match(graph, node, port)
                if (inputMatch !== false) {
                  match.inputs[inputMatcher.alias || index] = inputMatch
                  match.inputs[inputMatcher.alias || index].port = inputPort
                  match.inputs[inputMatcher.alias || index].inPort = port
                  return true
                } else {
                  return false
                }
              }
            }
            if (predecessors.length === 1) {
              return predecessors.every(tryMatchPredecessor)
            } else {
              return tryMatchPredecessor({ node: null, port: null })
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
          let predecessors = realPredecessors(graph, n, inputPort)
          const tryMatchPredecessor = ({node, port}) => {
            let inputMatcher = inputs[inputPort]
            if (_.isFunction(inputMatcher)) {
              const inputMatch = inputMatcher(graph, node, port)
              if (inputMatch !== false) {
                match.inputs[inputPort] = inputMatch
                match.inputs[inputPort].port = inputPort
                match.inputs[inputPort].inPort = port
                return true
              } else {
                return false
              }
            } else {
              const inputMatch = inputMatcher.match(graph, node, port)
              if (inputMatch !== false) {
                match.inputs[inputMatcher.alias || inputPort] = inputMatch
                match.inputs[inputMatcher.alias || inputPort].port = inputPort
                match.inputs[inputMatcher.alias || inputPort].inPort = port
                return true
              } else {
                return false
              }
            }
          }
          if (predecessors.length === 1) {
            return predecessors.every(tryMatchPredecessor)
          } else {
            return tryMatchPredecessor({ node: null, port: null })
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
  return (graph, n, port) => {
    const node = graph.node(n)
    if (node && (node.id === 'math/const' || node.id === 'std/const')) {
      const match = { node: n, outputs: {}, inPort: port, port: Object.keys(node.outputPorts)[0] }
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

export function lambda (options = {}) {
  return (graph, n, port) => {
    const node = graph.node(n)

    if (node && node.id === 'functional/lambda') {
      const implNode = graph.node(graph.children(n)[0])
      if (typeof options.recursive !== 'undefined') {
        if ((options.recursive && !(node.settings && node.settings.recursive)) ||
            (!options.recursive && (node.settings && node.settings.recursive))) {
          return false
        }
      }
      if (typeof options.sideeffects !== 'undefined') {
        if ((options.sideeffects && !node.sideeffects) ||
            (!options.sideeffects && node.sideeffects)) {
          return false
        }
      }
      if (typeof options.inputPorts !== 'undefined') {
        if (Object.keys(implNode.inputPorts).length !== options.inputPorts) {
          return false
        }
      }
      if (typeof options.outputPorts !== 'undefined') {
        if (Object.keys(implNode.outputPorts).length !== options.outputPorts) {
          return false
        }
      }
      return { node: n, inPort: port, port: Object.keys(node.outputPorts)[0] }
    }
    return false
  }
}

export function sink (matcher = any()) {
  return (graph, node) => {
    if (node && graph.successors(node).length === 0) {
      return matcher(graph, node)
    }
    return false
  }
}

export function alias (alias, match) {
  return { match, alias }
}

export function movable (matcher = any()) {
  return (graph, node) => {
    if (!graph.hasNode(node)) {
      return false
    }
    const parent = graph.parent(node)
    const isMoveable = (graph, node) => {
      return graph.parent(node) === parent &&
             _.flattenDeep(Object.keys(graph.node(node).outputPorts).map((port) => atomicSuccessorsInPort(graph, node, port))).length === 1 && // TODO if the branch has no side-effects, we could copy it and the number of successors of a node could be more than one
             Object.keys(graph.node(node).inputPorts || {}).every((port) => {
               return walk.predecessor(graph, node, port).every(({node}) => isMoveable(graph, node))
             })
    }
    if (isMoveable(graph, node)) {
      return matcher(graph, node)
    } else {
      return false
    }
  }
}

/**
 * A matcher for development that wraps an existing matcher and only matches once.
 */
export function once (matcher) {
  let matched = false
  return (graph, node, port) => {
    if (matched) {
      return false
    } else {
      let match = matcher(graph, node, port)
      if (match !== false) {
        matched = true
      }
      return match
    }
  }
}

export function withState (fn) {
  const vars = {}
  return (graph, node, port) => {
    const state = {
      set (variable, matcher) {
        return (graph, node, port) => {
          const match = matcher(graph, node, port)
          vars[variable] = match
          return match
        }
      },

      get (variable) {
        return (graph, node, port) => {
          if (vars[variable] != null && vars[variable] !== false && vars[variable].node === node && port != null && vars[variable].inPort === port) {
            return vars[variable]
          } else {
            return false
          }
        }
      },

      getOrSet (variable, matcher) {
        return (graph, node, port) => {
          if (vars[variable] != null) {
            if (vars[variable] !== false && vars[variable].node === node && port != null && vars[variable].inPort === port) {
              return vars[variable]
            } else {
              return false
            }
          } else {
            const match = matcher(graph, node, port)
            vars[variable] = match
            return match
          }
        }
      }
    }
    return fn(state)(graph, node, port)
  }
}

export function byIdAndSameInputs (id, ports, inputMatcher) {
  return withState((state) =>
    byIdAndInputs(id, _.zipObject(ports, _.map(ports, () => state.getOrSet('p', inputMatcher))))
  )
}
