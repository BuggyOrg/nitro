import { walk } from '@buggyorg/graphtools'
import { getLambdaFunctionType } from '@buggyorg/functional'
import _ from 'lodash'
import { childrenDeep } from '../../../util/graph'
import { createEdge, createInputPort, createOutputPort, tryGetInputPort, moveNodeInto, unpackCompoundNode,
         createEdgeToEachSuccessor, createEdgeFromEachPredecessor, deepRemoveNode, renamePort } from '../../../util/rewrite'
import { copyNodeInto } from '../../../util/copy'
import * as nodeCreator from '../../nodes'

const knownMonoids = [
  {
    operation: 'math/multiply',
    neutralElement: () => nodeCreator.constantNumber(1)
  },
  {
    operation: 'math/add',
    neutralElement: () => nodeCreator.constantNumber(0)
  }
]

/**
 * Checks if the given node is a rewritable linear recursive compound node.
 * @param graph a graphlib graph
 * @param node a node name
 * @return either false or a match
 */
export function matchLinearRecursiveCompound (graph, n) {
  // in Buggy, a compound is linear recursive if it ends with a chain of `logic/mux` nodes and recursive calls only
  // occur in this chain, before one operation
  // this operation needs to be a known associative function with a neutral element (~monoid)

  // for now, only simple linear recursions with one logic/mux node are supported
  // i.e. (defco length [list] (logic/mux (array/isEmpty list) 0 (+ (length (array/rest list)) 1)))

  const compoundNode = graph.node(n)
  const allRecursiveCalls = childrenDeep(graph, n).filter((c) => graph.node(c).id === compoundNode.id)
  if (allRecursiveCalls.length !== 1) {
    return false
  }

  const muxNode =  walk.predecessor(graph, n, Object.keys(compoundNode.outputPorts || {})[0])[0]
  if (!muxNode) {
    return false
  }

  const input1 = walk.predecessor(graph, muxNode.node, 'input1')[0].node
  const input2 = walk.predecessor(graph, muxNode.node, 'input2')[0].node

  let recursivePort

  if (knownMonoids.find((m) => m.operation === graph.node(input1).id) && Object.keys(graph.node(input1).inputPorts).some((p) => {
    const predecessor = graph.node(walk.predecessor(graph, input1, p)[0].node)
    return predecessor.id === compoundNode.id && !predecessor.recursiveRoot
  })) {
    recursivePort = 'input1'
  } else if (knownMonoids.find((m) => m.operation === graph.node(input2).id) && Object.keys(graph.node(input2).inputPorts).some((p) => {
    const predecessor = graph.node(walk.predecessor(graph, input2, p)[0].node)
    return predecessor.id === compoundNode.id && !predecessor.recursiveRoot
  })) {
    recursivePort = 'input2'
  } else {
    return false
  }

  const associativeOperation = knownMonoids.find((m) => m.operation === graph.node(walk.predecessor(graph, muxNode.node, recursivePort)[0].node).id)

  return {
    node: n,
    predicate: walk.predecessor(graph, muxNode.node, 'control')[0],
    operation: associativeOperation,
    recursivePort
  }
}
