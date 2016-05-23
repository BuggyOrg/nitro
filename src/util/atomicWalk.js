import _ from 'lodash'
import { walk } from '@buggyorg/graphtools'

/**
 * Gets the atomic predecessor nodes and output ports of the given node.
 */
export function atomicPredecessorsOutPort (graph, node, port) {
  return _.flatten(walk.predecessor(graph, node, port)
    .map(({ node, port }) => {
      if (graph.node(node).atomic) {
        return { node, port }
      } else {
        return atomicPredecessorsOutPort(graph, node, port)
      }
    }))
}

/**
 * Gets the atomic successor nodes and input ports of the given node.
 */
export function atomicSuccessorsInPort (graph, node, port) {
  return _.flatten(walk.successor(graph, node, port)
    .map(({ node, port }) => {
      if (graph.node(node).atomic) {
        return { node, port }
      } else {
        return atomicSuccessorsInPort(graph, node, port)
      }
    }))
}
