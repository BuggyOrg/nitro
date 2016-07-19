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
  const compoundNode = graph.node(n)
  const allRecursiveCalls = childrenDeep(graph, n).filter((c) => graph.node(c).id === compoundNode.id)
  if (allRecursiveCalls.length === 0) {
    return false
  }

  let associativeOperation // the associative operation, set while walking up the `logic/mux` chain
  const predicates = [] // collected while walking up the `logic/mux` chain

  // in Buggy, a compound is linear recursive if it ends with a chain of `logic/mux` nodes and recursive calls only
  // occur in this chain, before one operation
  // this operation needs to be a known associative function with a neutral element (~monoid)

  const walkMuxChain = (node, port) => {
    return walk.predecessor(graph, node, port).map((p) => {
      const predecessor = graph.node(p.node)
      if (predecessor.id === 'logic/mux') {
        const predicate = {
          control: walk.predecessor(graph, p.node, 'control')[0],
          input1: { predecessor: walk.predecessor(graph, p.node, 'input1')[0] },
          input2: { predecessor: walk.predecessor(graph, p.node, 'input2')[0] }
        }
        // TODO check for recursive call and associative operation
        if (associativeOperation) {
          if (graph.node(predicate.input1.predecessor.node).id === associativeOperation.operation) {

          }
        }

        predicate.input1.type = graph.node(predicate.input1.predecessor.node).id
        predicate.input1.isTailcall = predicate.input1.type === compoundNode.id && predicate.input1.predecessor.port === Object.keys(compoundNode.outputPorts)[0]
        predicate.input2.type = graph.node(predicate.input2.predecessor.node).id
        predicate.input2.isTailcall = predicate.input2.type === compoundNode.id && predicate.input2.predecessor.port === Object.keys(compoundNode.outputPorts)[0]

        predicates.push(predicate)

        return [walkMuxChain(p.node, 'input1'), walkMuxChain(p.node, 'input2')]
      } else if (predecessor.id === compoundNode.id) {
        return p.node
      }
    })
  }
  const recursiveCalls = _.without(_.flattenDeep(walkMuxChain(n, Object.keys(compoundNode.outputPorts || {})[0])), n)

  // TODO
  if (_.difference(recursiveCalls, allRecursiveCalls).length === 0 && recursiveCalls.every((c) => {
    const call = graph.node(c)
    return Object.keys(call.outputPorts).every((port) => walk.successor(graph, c, port).every((successor) => {
      return graph.node(successor.node).id === compoundNode || graph.node(successor.node).id === 'logic/mux'
    }))
  })) {
    return {
      node: n,
      predicates: _.uniqBy(predicates, 'node'),
      tailcalls: _.uniq(tailcalls),
      operation: associativeOperation
    }
  } else {
    return false
  }
}
