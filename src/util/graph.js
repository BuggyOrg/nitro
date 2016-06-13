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
