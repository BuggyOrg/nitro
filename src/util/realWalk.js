import _ from 'lodash'
import { walk } from '@buggyorg/graphtools'

/**
 * Gets the actual predecessor nodes of the given node (and not parent nodes).
 */
export function realPredecessors (graph, node, port) {
  return _.flatten(walk.predecessor(graph, node, port).map((predecessor) => {
    if (graph.parent(node) === predecessor.node) {
      return realPredecessors(graph, predecessor.node, predecessor.port)
    } else {
      return predecessor
    }
  }))
}
