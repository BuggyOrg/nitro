import { walk } from '@buggyorg/graphtools'

/**
 * Replaces a node in a graph and re-connects input and output ports.
 * @param graph graph
 * @param node name of the node to replace
 * @param newValue new value of the node
 * @param portRewrites port rewrite rules, i.e. `{inputPorts: [{oldPort: 'a', newPort: 'b'}], outputPorts: [{oldPort: 'out', newPort: 'result'}]}`
 */
export function replaceNode (graph, node, newValue, portRewrites) {
  const newNode = `${node}:rewritten`
  const oldValue = graph.node(node)

  // create a new node exactly where the old node is
  newValue.path = oldValue.path
  newValue.branchPath = oldValue.branchPath
  newValue.branch = oldValue.branch

  graph.setNode(newNode, newValue)
  if (oldValue.parent != null) {
    graph.setParent(newNode, oldValue.parent)
  }

  // connect input ports
  ;(portRewrites.inputPorts || []).forEach(({oldPort, newPort}) => {
    walk.predecessorOutPort(graph, node, oldPort).forEach(n => {
      const edgeName = `${n.node}@${n.port}_to_${newNode}@${newPort}`

      graph.setEdge(newNode, n.node, {
        outPort: n.port,
        inPort: newPort
      }, edgeName)
    })
  })

  // connect output ports
  ;(portRewrites.outputPorts || []).forEach(({oldPort, newPort}) => {
    walk.successorInPort(graph, node, oldPort).forEach(n => {
      const edgeName = `${newNode}@${newPort}_to_${n.node}@${n.port}`

      graph.setEdge(newNode, n.node, {
        outPort: newPort,
        inPort: n.port
      }, edgeName)
    })
  })

  graph.removeNode(node)
}
