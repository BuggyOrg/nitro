import { walk } from '@buggyorg/graphtools'
import { getLambdaFunctionType } from '@buggyorg/functional'
import _ from 'lodash'
import { childrenDeep } from '../../../util/graph'
import { createEdge, createInputPort, createOutputPort, tryGetInputPort, moveNodeInto, unpackCompoundNode,
         createEdgeToEachSuccessor, createEdgeFromEachPredecessor, deepRemoveNode, renamePort, removeEdge,
         setNodeAt } from '../../../util/rewrite'
import { copyNodeInto } from '../../../util/copy'
import * as nodeCreator from '../../nodes'

const knownMonoids = [
  {
    operation: 'math/multiply',
    createOperation: (graph, a, b, context) => {
      const node = setNodeAt(graph, _.uniqueId('associative_operation'), context, nodeCreator.multiply())
      createEdge(graph, a, { node, port: 'm1' })
      createEdge(graph, b, { node, port: 'm2' })
      return node
    },
    neutralElement: () => nodeCreator.constantNumber(1)
  },
  {
    operation: 'math/add',
    createOperation: (graph, a, b, context) => {
      const node = setNodeAt(graph, _.uniqueId('associative_operation'), context, nodeCreator.add())
      createEdge(graph, a, { node, port: 's1' })
      createEdge(graph, b, { node, port: 's2' })
      return node
    },
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

  const input1 = walk.predecessor(graph, muxNode.node, 'input1')[0]
  const input2 = walk.predecessor(graph, muxNode.node, 'input2')[0]

  let recursivePort
  let operationRecursivePort

  if (knownMonoids.find((m) => m.operation === graph.node(input1.node).id) && Object.keys(graph.node(input1.node).inputPorts).some((p) => {
    const predecessor = graph.node(walk.predecessor(graph, input1.node, p)[0].node)
    if (predecessor.id === compoundNode.id && !predecessor.recursiveRoot) {
      operationRecursivePort = p
      return true
    } else {
      return false
    }
  })) {
    recursivePort = 'input1'
  } else if (knownMonoids.find((m) => m.operation === graph.node(input2.node).id) && Object.keys(graph.node(input2.node).inputPorts).some((p) => {
    const predecessor = graph.node(walk.predecessor(graph, input2.node, p)[0].node)
    if (predecessor.id === compoundNode.id && !predecessor.recursiveRoot) {
      operationRecursivePort = p
      return true
    } else {
      return false
    }
  })) {
    recursivePort = 'input2'
  } else {
    return false
  }

  const associativeOperationNode = walk.predecessor(graph, muxNode.node, recursivePort)[0].node
  const associativeOperation = knownMonoids.find((m) => m.operation === graph.node(associativeOperationNode).id)

  return {
    node: n,
    operation: associativeOperation,
    operationRecursivePort,
    operationNode: associativeOperationNode,
    muxNode: {
      node: muxNode,
      input1,
      input2
    },
    recursivePort,
    recursiveCall: allRecursiveCalls[0]
  }
}

export function rewriteLinearRecursionToTailRecursion (graph, node, match) {
  const accPort = _.uniqueId('acc')

  // non-recursive input port: multiply with acc
  const nonRecursiveInput = match.recursivePort === 'input1' ? 'input2' : 'input1'
  removeEdge(graph,
    match.muxNode[nonRecursiveInput], 
    { node: match.muxNode.node.node, port: nonRecursiveInput })
  const newNonRecursiveInput = match.operation.createOperation(graph,
    match.muxNode[nonRecursiveInput],
    { node, port: accPort },
    match.muxNode.node.node)
  createEdge(graph, newNonRecursiveInput, { node: match.muxNode.node.node, port: nonRecursiveInput })

  // recursive input port: remove associative operation, call new tailrec node with original args + acc
  const tailrecCall = setNodeAt(graph, _.uniqueId('tailrec_call'), match.muxNode.node.node, _.clone(graph.node(match.recursiveCall)))
  Object.keys(graph.node(match.recursiveCall).inputPorts).forEach((p) => walk.predecessor(graph, match.recursiveCall, p).forEach((predecessor) => {
    createEdge(graph, predecessor, { node: tailrecCall, port: p })
  }))
  createEdge(graph, tailrecCall, { node: match.muxNode.node.node, port: match.recursivePort })
  const tailrecCallAcc = match.operation.createOperation(graph,
    walk.predecessor(graph, match.operationNode, _.without(Object.keys(graph.node(match.operationNode).inputPorts), match.operationRecursivePort)[0])[0],
    { node, port: accPort },
    match.muxNode.node.node)
  createEdge(graph, tailrecCallAcc, { node: tailrecCall, port: accPort })

  graph.removeNode(match.muxNode[match.recursivePort].node)
  graph.removeNode(match.recursiveCall)

  // add the new acc port to the compound node
  const accType = graph.node(tailrecCallAcc).inputPorts[Object.keys(graph.node(tailrecCallAcc).inputPorts)[0]]
  createInputPort(graph, node, accPort, accType)
  createInputPort(graph, tailrecCall, accPort, accType)

  // initial acc value
  const neutralElement = setNodeAt(graph, _.uniqueId('neutral_element'), node, match.operation.neutralElement())
  createEdge(graph, neutralElement, { node, port: accPort })
}
