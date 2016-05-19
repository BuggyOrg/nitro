import { replaceNode, deleteUnusedPredecessors, createEdgeToEachSuccessor } from '../util/rewrite'
import { walk } from '@buggyorg/graphtools'

export function withNode (nodeCreator) {
  return (graph, node, match) => {
    const newNode = nodeCreator(graph, node, match)

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

/**
 * Bridge over one or more nodes by creating edges around them.
 * The matched node and any unused predecessors will be removed.
 *
 * The bridgeCreator must return an array of bridges, i.e.
 * `[{ source: { node: 'nodeName', port: 'port' }, target: { node: 'node', port: 'port' } }]`
 * where each bridge will create edges from the source to any direct successor of the target (and
 * not to the target itself).
 */
export function bridgeOver (bridgeCreator) {
  return (graph, node, match) => {
    let bridges = bridgeCreator(graph, node, match)

    bridges.forEach(({ source, target }) => {
      createEdgeToEachSuccessor(graph, source, target)
    })

    deleteUnusedPredecessors(graph, node)
    graph.removeNode(node)
  }
}
