import _ from 'lodash'
import { walk } from '@buggyorg/graphtools'
import { realPredecessors } from '../util/realWalk'
import { atomicSuccessorsInPort } from '../util/atomicWalk'

/**
 * Create a matcher that matches any node.
 * @param options an object object, if the requireNode attribute is set to false, no actual node is required
 * @returns a matcher for any node
 */
export function any (options = {}) {
  if (options.requireNode === false) {
    return (graph, node, port) => ({ node, inPort: port })
  } else {
    return (graph, node, port) => graph.hasNode(node) ? { node, inPort: port } : false
  }
}

/**
 * Create a matcher that matches if one of the given matcher matches.
 * @param rules matchers
 * @returns the first match or false if no matcher matches
 */
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

/**
 * Create a matcher that matches a node by its ID and predecessors.
 * @params id ID of the node to match
 * @params inputs predecessor matchers
 * @returns a matcher
 */
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

/**
 * Create a matcher that matches constant nodes.
 * @param value value of the constant node
 * @param outputAlias alias for the output port
 * @returns a matcher for constant nodes
 */
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

/**
 * Create a matcher for lambda functions.
 * @param options option object
 * @returns a matcher for lambda functions
 */
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

/**
 * Wrap a matcher with an alias.
 * @returns alias object for the given matcher
 */
export function alias (alias, match) {
  return { match, alias }
}

/**
 * Create a matcher that matches movable nodes. The node must match the given matcher (default to any).
 * @param matcher matcher for the movable node
 * @returns a matcher for movable nodes
 */
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
 * @param matcher matcher that should only match once
 * @returns a matcher that is like the given matcher but only matches once
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

/**
 * Create a matcher that has a state and may compare nodes while matching.
 * @params fn the function that is invoked with the state and that returns a matcher
 * @returns the result of the matcher that fn creates
 */
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

/**
 * Create a matcher that matches a node with the given ID and ports that have the same predecessor.
 * @param id ID of the node
 * @param ports ports that should have the same predecessor
 * @param inputMatcher matcher for the predecessors
 * @returns matcher function
 */
export function byIdAndSameInputs (id, ports, inputMatcher) {
  return withState((state) =>
    byIdAndInputs(id, _.zipObject(ports, _.map(ports, () => state.getOrSet('p', inputMatcher))))
  )
}

/**
 * Create a matcher that matches output ports of the given type. The optional matcher is also checked
 * for the given node, defaults to any.
 * @param type type of the output port
 * @param matcher matcher to match nodes with
 * @returns result of the given matcher or false if there is no match
 */
export function type (type, matcher = any()) {
  return (graph, node, port) => {
    if (graph.node(node).outputPorts[port] === type) {
      return matcher(graph, node, port)
    }
    return false
  }
}
