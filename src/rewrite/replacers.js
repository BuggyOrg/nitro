import { replaceNode, deleteUnusedPredecessors } from '../util/rewrite'

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
