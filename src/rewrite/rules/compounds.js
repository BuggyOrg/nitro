import { walk } from '@buggyorg/graphtools'
import { unpackCompoundNode, moveNodeInto, createEdge, removePort } from '../../util/rewrite'
import { rule, match } from '../rewrite'
import { childrenDeep, isSamePort } from '../../util/graph'
import { realPredecessors } from '../../util/realWalk'
import { matchTailRecursiveCompound, rewriteTailRecursionToLoop } from './tailrecursion'

export const removeUnnecessaryCompoundNodes = rule(
  (graph, n) => {
    const node = graph.node(n)
    const parent = graph.node(graph.parent(n))
    if (node &&
        !node.recursive && !node.recursesTo && !node.recursiveRoot &&
        !node.atomic &&
        node.id !== 'functional/lambda' &&
        !(parent && parent.id === 'functional/lambda')) {
        // Object.keys(node.inputPorts || {}).every((p) => walk.predecessor(graph, n, p).length > 0) &&
        // Object.keys(node.outputPorts || {}).every((p) => walk.successor(graph, n, p).length > 0)) {
      return { node }
    } else {
      return false
    }
  },
  (graph, node) => unpackCompoundNode(graph, node),
  { name: 'remove unnecessary compound' }
)

export const moveInputsIntoRecursiveCompounds = rule(
  (graph, n) => {
    const node = graph.node(n)
    if (node && !node.atomic) {
      // check if all recursive calls (and the initial call) have the same input at one port (and if this input can be moved)
      const recursiveCalls = childrenDeep(graph, n).filter((c) => graph.node(c).id === node.id)
      if (recursiveCalls.length === 0) {
        return false
      }
      const constantInputPort = Object.keys(node.inputPorts).find((port) => {
        const predecessor = realPredecessors(graph, n, port)
        return predecessor.length === 1 && match.movable()(graph, predecessor[0].node) &&
               recursiveCalls.every((call) => isSamePort(realPredecessors(graph, call, port)[0], predecessor[0]))
      })
      return constantInputPort ? { node, constantInputPort, recursiveCalls } : false
    } else {
      return false
    }
  },
  (graph, node, { constantInputPort, recursiveCalls }) => {
    const predecessor = walk.predecessor(graph, node, constantInputPort)[0]
    const successors = walk.successor(graph, node, constantInputPort)

    // inline the node
    moveNodeInto(graph, predecessor.node, node)
    successors.forEach((successor) => {
      createEdge(graph, predecessor, successor)
    })
    removePort(graph, node, constantInputPort)

    // modify all recursive calls (remove the port)
    recursiveCalls.forEach((call) => removePort(graph, call, constantInputPort))
  },
  { name: 'move constant input into recursive compound' }
)

export const tailRecursionToLoop = rule(
  matchTailRecursiveCompound,
  (graph, node, match) => {
    rewriteTailRecursionToLoop(graph, node, match)
  }
)
