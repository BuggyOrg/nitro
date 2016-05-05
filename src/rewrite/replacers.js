import { replaceNode, deleteUnusedPredecessors } from '../util/rewrite'

export function withNode (nodeCreator) {
  return (graph, node, match) => {
    const newNode = nodeCreator(graph, node, match)
    deleteUnusedPredecessors(graph, node)


    const rewriteInputPorts = Object.keys(newNode.rewriteInputPorts || {}).map((oldPort) => {
      return {
        oldPort,
        newPort: newNode.rewriteOutputPorts[oldPort]
      }
    })
    const rewriteOutputPorts = Object.keys(newNode.rewriteOutputPorts || {}).map((oldPort) => {
      return {
        oldPort,
        newPort: newNode.rewriteOutputPorts[oldPort]
      }
    })

    replaceNode(graph, node, newNode.node, {
      inputPorts: rewriteInputPorts,
      outputPorts: rewriteOutputPorts
    })
  }
}
