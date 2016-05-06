import { replaceNode, deleteUnusedPredecessors } from '../util/rewrite'
import { walk } from '@buggyorg/graphtools'

export function withNode (nodeCreator) {
  return (graph, node, match) => {
    const newNode = nodeCreator(graph, node, match)
    deleteUnusedPredecessors(graph, node)

    replaceNode(graph, node, newNode.node, {
      inputPorts: newNode.rewriteInputPorts || [],
      outputPorts: newNode.rewriteOutputPorts || []
    })
  }
}

export function removeNode (portRewriter) {
  return (graph, node, match) => {
    let rewritePorts = portRewriter(graph, node, match)
    
    rewritePorts.forEach(({ fromPort, toPort }) => {
      walk.predecessorOutPort(graph, node, fromPort).forEach((source) => {
        walk.successorInPort(graph, node, toPort).forEach((target) => {
          const edgeName = `${source.node}@${source.port}_to_${target.node}@${target.node}`
    
          graph.setEdge(source.node, target.node, {
            outPort: source.port,
            inPort: target.port
          }, edgeName)
        })
      })
    })
    
    deleteUnusedPredecessors(graph, node)
    graph.removeNode(node)
  }
}
