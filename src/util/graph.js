import _ from 'lodash'

/**
 * Get all nested children of a node.
 * @param graph graphlib graph
 * @param node node name
 * @returns all nested children of the node
 */
export function childrenDeep (graph, node) {
  const children = graph.children(node)
  return _.flattenDeep([
    children,
    children.map((c) => childrenDeep(graph, c))
  ])
}

/**
 * Check if two values have the same node and port attribute.
 * @param a node
 * @param b another node
 * @returns true if both arguments have the same node and port attributes
 */
export function isSamePort (a, b) {
  return a.node === b.node && a.port === b.port
}

/**
 * Gets the input ports of the given node, with correct argument order if possible.
 * @export
 * @param {Graphlib} graph graphlib graph
 * @param {string} n node name
 * @returns {array} input port names
 */
export function getInputPorts (graph, n) {
  const node = graph.node(n)

  if (!node.inputPorts) {
    return []
  }

  if (node.settings && node.settings.argumentOrdering) {
    return node.settings.argumentOrdering.filter((p) => node.inputPorts[p] != null)
  } else {
    return Object.keys(node.inputPorts)
  }
}

/**
 * Gets the output ports of the given node, with correct argument order if possible.
 * @export
 * @param {Graphlib} graph graphlib graph
 * @param {string} n node name
 * @returns {array} output port names
 */
export function getOutputPorts (graph, n) {
  const node = graph.node(n)

  if (!node.outputPorts) {
    return []
  }

  if (node.settings && node.settings.argumentOrdering) {
    return node.settings.argumentOrdering.filter((p) => node.outputPorts[p] != null)
  } else {
    return Object.keys(node.outputPorts)
  }
}
