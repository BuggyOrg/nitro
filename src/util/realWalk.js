import _ from 'lodash'
import { walk } from '@buggyorg/graphtools'

/**
 * Gets the actual predecessor nodes of the given node (and not parent nodes).
 * If `options.crossRecursiveBoundaries` is set to true, this method will not cross boundaries
 * of recursive compound nodes and return no predecessors instead.
 * @param graph graphlib graph
 * @param node node name
 * @param port name
 * @param options options, may have a crossRecursiveBoundaries attribute set to true to cross the bounds of recursive compound nodes
 */
export function realPredecessors (graph, node, port, options = { crossRecursiveBoundaries: false }) {
  return _.flatten(walk.predecessor(graph, node, port).map((predecessor) => {
    if (graph.parent(node) === predecessor.node) {
      if (options.crossRecursiveBoundaries || !graph.node(predecessor.node).recursiveRoot) {
        return realPredecessors(graph, predecessor.node, predecessor.port)
      } else {
        return []
      }
    } else {
      return predecessor
    }
  }))
}
