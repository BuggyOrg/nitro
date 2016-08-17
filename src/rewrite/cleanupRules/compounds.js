import _ from 'lodash'
import { walk } from '@buggyorg/graphtools'
import { rule } from '../rewrite'
import { createEdge, createInputPort, removeEdges, removePort } from '../../util/rewrite'
import { childrenDeep } from '../../util/graph'

/**
 * Move nodes out of recursive compound nodes that don't depend on the input
 * ports of the recursive compound.
 */
export const moveIndependentNodesOutOfRecursiveCompounds = rule(
  (graph, n) => {
    // match recursive compound nodes that have child nodes that are independent of the compound's input ports
    const node = graph.node(n)
    if (!node.atomic && node.recursiveRoot) {
      const recursiveCalls = childrenDeep(graph, n).filter((c) => graph.node(c).id === node.id)
      if (recursiveCalls.every((c) => graph.parent(c) === n)) {
        let movableNodes = graph.children(n)
          .filter((c) => {
            const childNode = graph.node(c)
            return Object.keys(childNode.inputPorts || {}).length === 0 && !childNode.sideeffects && childNode.id !== node.id
          })

        if (movableNodes.length > 0) {
          return {
            node: n,
            movableNodes,
            recursiveCalls
          }
        } else {
          return false
        }
      } else {
        return false
      }
    } else {
      return false
    }
  },
  (graph, n, match) => {
    match.movableNodes.forEach((node) => {
      const nodeValue = graph.node(node)
      const oldEdges = graph.nodeEdges(node)

      Object.keys(nodeValue.outputPorts || {}).forEach((port) => {
        const successors = walk.successor(graph, node, port)
        const newPort = createInputPort(graph, n, `${node}_${port}`, nodeValue.outputPorts[port])
        createEdge(graph, { node, port }, { node: n, port: newPort })

        successors.forEach((successor) => {
          createEdge(graph, { node: n, port: newPort }, successor)
        })

        match.recursiveCalls.forEach((c) => {
          const newPort = createInputPort(graph, c, `${node}_${port}`, nodeValue.outputPorts[port])
          createEdge(graph, { node: n, port: newPort }, { node: c, port: newPort })
        })
      })

      oldEdges.forEach((e) => graph.removeEdge(e))
      graph.setParent(node, graph.parent(n))
    })
  }
)

/**
 * Move nodes out of recursive compound nodes that only depend on the compound's
 * input ports, even in recursive calls.
 */
export const moveMovableFirstNodesOutOfRecursiveCompounds = rule(
  (graph, n) => {
    // match recursive compound nodes that have child nodes that only depend on the compound's input ports
    const node = graph.node(n)
    if (!node.atomic && node.recursiveRoot) {
      const recursiveCalls = childrenDeep(graph, n).filter((c) => graph.node(c).id === node.id)
      if (recursiveCalls.every((c) => graph.parent(c) === n)) {
        let movableNodes = _.uniq(_.flattenDeep(Object.keys(node.inputPorts || {}).map((p) => walk.successor(graph, n, p).map(({ node }) => node))))
          .filter((c) => {
            const childNode = graph.node(c)
            return !childNode.sideeffects && childNode.id !== node.id &&
                  Object.keys(childNode.inputPorts || {}).every((p) =>
                    walk.predecessor(graph, c, p).every(({ node, port }) => {
                      if (node === n) {
                        return recursiveCalls.every((call) => {
                          const predecessor = walk.predecessor(graph, call, port)[0]
                          return predecessor != null && predecessor.node === node && predecessor.port === port
                        })
                      } else {
                        return false
                      }
                    })
                  )
          })

        if (movableNodes.length > 0) {
          return {
            node: n,
            movableNodes,
            recursiveCalls
          }
        } else {
          return false
        }
      } else {
        return false
      }
    } else {
      return false
    }
  },
  (graph, n, match) => {
    match.movableNodes.forEach((node) => {
      const nodeValue = graph.node(node)
      const oldEdges = graph.nodeEdges(node)

      Object.keys(nodeValue.inputPorts || {}).forEach((port) => {
        walk.predecessor(graph, node, port).forEach((predecessor) => {
          walk.predecessor(graph, predecessor.node, predecessor.port).forEach((predecessor) => {
            createEdge(graph, predecessor, { node, port })
          })
        })
      })

      Object.keys(nodeValue.outputPorts || {}).forEach((port) => {
        const originalSuccessors = walk.successor(graph, node, port)

        const newPort = createInputPort(graph, n, `${node}_${port}`, nodeValue.outputPorts[port])
        createEdge(graph, { node, port }, { node: n, port: newPort })
        originalSuccessors.forEach((successor) => {
          createEdge(graph, { node: n, port: newPort }, successor)
        })

        match.recursiveCalls.forEach((c) => {
          const newPort = createInputPort(graph, c, `${node}_${port}`, nodeValue.outputPorts[port])
          createEdge(graph, { node: n, port: newPort }, { node: c, port: newPort })
        })

        walk.predecessor(graph, node, port).forEach((predecessor) => {
          walk.predecessor(graph, predecessor.node, predecessor.port).forEach((predecessor) => {
            createEdge(graph, predecessor, { node, port })
          })
        })
      })

      oldEdges.forEach((e) => graph.removeEdge(e))
      graph.setParent(node, graph.parent(n))
    })
  }
)

/**
 * Remove input ports of recursive compound nodes that have no successors.
 */
export const removeUnusedInputPorts = rule(
  (graph, n) => {
    const node = graph.node(n)
    if (node.recursiveRoot) {
      const recursiveCalls = childrenDeep(graph, n).filter((c) => graph.node(c).id === node.id)
      const unusedInputPorts = Object.keys(node.inputPorts || {}).filter((port) =>
        walk.successor(graph, n, port).every((successor) => graph.node(successor.node).id === node.id && successor.port === port) &&
        recursiveCalls.every((call) => walk.predecessor(graph, call, port).every((predecessor) => predecessor.node === n && predecessor.port === port))
      )
      if (unusedInputPorts.length > 0) {
        return {
          node: n,
          unusedInputPorts,
          recursiveCalls
        }
      }
    }
    return false
  },
  (graph, n, match) => {
    match.unusedInputPorts.forEach((port) => {
      removeEdges(graph, n, port)
      removePort(graph, n, port)

      match.recursiveCalls.forEach((call) => {
        removeEdges(graph, call, port)
        removePort(graph, call, port)
      })
    })
  }
)
