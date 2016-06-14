import { walk } from '@buggyorg/graphtools'
import _ from 'lodash'
import { childrenDeep } from '../../../util/graph'

/**
 * Checks if the given node is a tail-recursive compound node.
 * @param graph a graphlib graph
 * @param node a node name
 * @return either false or a match
 */
export function matchTailRecursiveCompound (graph, n) {
  const compoundNode = graph.node(n)
  const recursiveCalls = childrenDeep(graph, n).filter((c) => graph.node(c).id === compoundNode.id)
  if (recursiveCalls.length === 0) {
    return false
  }

  const predicates = [] // collected while walking up the `logic/mux` chain

  // in Buggy, a compound is tail-recursive if it ends with a chain of `logic/mux` nodes and recursive calls only
  // occur in this chain
  const walkMuxChain = (node, port) => {
    return walk.predecessor(graph, node, port).map((p) => {
      const predecessor = graph.node(p.node)
      if (predecessor.id === 'logic/mux') {
        predicates.push(walk.predecessor(graph, p, 'control')[0])
        return [walkMuxChain(p.node, 'input1'), walkMuxChain(p.node, 'input2')]
      } else if (predecessor.id === compoundNode.id) {
        return p.node
      }
    })
  }
  const tailcalls = _.without(_.flattenDeep(walkMuxChain(n, Object.keys(compoundNode.outputPorts || {})[0])), n)

  // TODO more validation, every mux may only be used once
  // every recursive call should be a tail call and not be used otherwise
  if (_.difference(recursiveCalls, tailcalls).length === 0 && recursiveCalls.every((c) => {
    const call = graph.node(c)
    return Object.keys(call.outputPorts).every((port) => walk.successor(graph, c, port).every((successor) => {
      return graph.node(successor.node).id === compoundNode || graph.node(successor.node).id === 'logic/mux'
    }))
  })) {
    return {
      node: n,
      predicates: _.uniq(predicates),
      tailcalls: _.uniq(tailcalls)
    }
  } else {
    return false
  }
}
