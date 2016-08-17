import _ from 'lodash'
import { walk } from '@buggyorg/graphtools'

/**
 * Get the atomic predecessor nodes and output ports of the given node.
 * @param graph graphlib graph
 * @param node node name
 * @param port port name
 * @returns array of predecessors
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
 * Get the atomic successor nodes and input ports of the given node.
 * @param graph graphlib graph
 * @param node node name
 * @param port port name
 * @returns array of successors
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
