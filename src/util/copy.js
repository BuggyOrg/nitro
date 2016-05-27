import _ from 'lodash'

function copyNodeInto (graph, node, target) {
  const nodeCopy = `${node}_${_.uniqueId('copy_')}`
  const newNodeValue = _.cloneDeep(graph.node(node))

  graph.setNode(nodeCopy, newNodeValue)
  graph.setParent(nodeCopy, target)

  const children = {}
  graph.children(node).forEach((child) => {
    children[child] = copyNodeInto(graph, child, nodeCopy)
  })

  graph.edges().forEach((e) => {
    const source = children[e.v]
    const target = children[e.w]
    if (source && target) {
      graph.setEdge(source, target, _.cloneDeep(graph.edge(e)), `${e}_${_.uniqueId('copy_')}`)
    } else if (source && e.w === node) {
      graph.setEdge(source, nodeCopy, _.cloneDeep(graph.edge(e)), `${e}_${_.uniqueId('copy_')}`)
    } else if (target && e.v === node) {
      graph.setEdge(nodeCopy, target, _.cloneDeep(graph.edge(e)), `${e}_${_.uniqueId('copy_')}`)
    }
  })

  return nodeCopy
}

export function copyNode (graph, node) {
  return copyNodeInto(graph, node, graph.parent(node))
}
