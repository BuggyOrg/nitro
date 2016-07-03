import _ from 'lodash'

export function childrenDeep (graph, node) {
  const children = graph.children(node)
  return _.flattenDeep([
    children,
    children.map((c) => childrenDeep(graph, c))
  ])
}

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
