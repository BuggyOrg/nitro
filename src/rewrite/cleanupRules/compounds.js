import _ from 'lodash'
import { walk } from '@buggyorg/graphtools'
import { getLambdaFunctionType } from '@buggyorg/functional'
import { rule, match } from '../rewrite'
import { createEdgeToEachSuccessor, deleteUnusedPredecessors, setNodeAt, setNodeIn, removeEdge, createEdge, createInputPort } from '../../util/rewrite'
import { childrenDeep } from '../../util/graph'
import * as nodeCreators from '../nodes'
import createSubgraph from '../../util/subgraphCreator'

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

      // TODO
      graph.setParent(node, graph.parent(n))
    })
  }
)
