import _ from 'lodash'
import { walk } from '@buggyorg/graphtools'

/**
 * Gets the atomic predecessor nodes and output ports of the given node.
 */
export function atomicPredecessorsOutPort (graph, node, port) {
  return _.flatten(walk.predecessorOutPort(graph, node, port)
    .map(({ node, port }) => {
      if (graph.node(node).atomic) {
        return { node, port }
      } else {
        return atomicPredecessorsOutPort(graph, node, port)
      }
    }))
}
