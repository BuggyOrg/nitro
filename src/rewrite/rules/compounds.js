import { walk } from '@buggyorg/graphtools'
import { isUnnecessaryCompound, unpackCompoundNode, moveNodeInto, createEdge, removePort } from '../../util/rewrite'
import { rule, match } from '../rewrite'
import { childrenDeep, isSamePort } from '../../util/graph'
import { realPredecessors } from '../../util/realWalk'
import { matchTailRecursiveCompound, rewriteTailRecursionToLoop } from './tailrecursion'
import { matchLinearRecursiveCompound, rewriteLinearRecursionToTailRecursion } from './linearrecursion'

export const removeUnnecessaryCompoundNodes = rule(
  isUnnecessaryCompound,
  (graph, node) => unpackCompoundNode(graph, node) ? { node } : false,
  { name: 'remove unnecessary compounds' }
)

export const moveInputsIntoRecursiveCompounds = rule(
  (graph, n) => {
    const node = graph.node(n)
    if (node && node.recursiveRoot) {
      // check if all recursive calls (and the initial call) have the same input at one port (and if this input can be moved)
      const recursiveCalls = childrenDeep(graph, n).filter((c) => graph.node(c).id === node.id)
      if (recursiveCalls.length === 0) {
        return false
      }
      const constantInputPort = Object.keys(node.inputPorts).find((port) => {
        const predecessor = realPredecessors(graph, n, port)
        
        // the branch is movable if the only successor is this compound node and if the predecessor in the branch are also movable
        return predecessor.length === 1 && Object.keys(graph.node(predecessor[0].node).inputPorts || {})
                .every((port) => walk.predecessor(graph, predecessor[0].node, port).every((p) => match.movable()(graph, p.node))) &&
               Object.keys(graph.node(predecessor[0].node).outputPorts || {}).every((port) => walk.successor(graph, predecessor[0].node, port).every((succ) => succ.node === n)) &&
               recursiveCalls.every((call) => {
                 const callPredecessor = realPredecessors(graph, call, port, { crossRecursiveBoundaries: true })
                 return callPredecessor.length === 1 && isSamePort(callPredecessor[0], predecessor[0])
               })
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
  rewriteTailRecursionToLoop
)

export const linearRecursionToTailRecursion = rule(
  match.once(matchLinearRecursiveCompound),
  rewriteLinearRecursionToTailRecursion
)
