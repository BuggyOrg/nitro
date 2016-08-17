import { replaceNode, deleteUnusedPredecessors, createEdgeToEachSuccessor, deepRemoveNode } from '../util/rewrite'
import { walk } from '@buggyorg/graphtools'
import _ from 'lodash'

/**
 * Create a replacer that replaces a match with a node.
 * @param nodeCreator function that creates a node
 * @returns replacer function
 */
export function withNode (nodeCreator) {
  return (graph, node, match) => {
    const newNode = nodeCreator(graph, node, match)

    replaceNode(graph, node, newNode.node, {
      inputPorts: newNode.rewriteInputPorts || [],
      outputPorts: newNode.rewriteOutputPorts || []
    })
  }
}

/**
 * Create a replacer that removes a matched node.
 * @param portRewriter an object that contains the port rewrite rules or a function that creates such an object
 * @returns replacer function
 */
export function removeNode (portRewriter) {
  return (graph, node, match) => {
    if (portRewriter) {
      let rewritePorts = _.isFunction(portRewriter) ? portRewriter(graph, node, match) : portRewriter

      rewritePorts.forEach(({ fromPort, toPort }) => {
        walk.predecessor(graph, node, fromPort).forEach((source) => {
          walk.successor(graph, node, toPort).forEach((target) => {
            const edgeName = `${source.node}@${source.port}_to_${target.node}@${target.node}`

            graph.setEdge(source.node, target.node, {
              outPort: source.port,
              inPort: target.port
            }, edgeName)
          })
        })
      })
    }

    deepRemoveNode(graph, node)
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
 * @param bridgeCreator bridge creator as described above
 * @returns replacer function
 */
export function bridgeOver (bridgeCreator) {
  return (graph, node, match) => {
    let bridges = _.isFunction(bridgeCreator) ? bridgeCreator(graph, node, match) : bridgeCreator

    bridges.forEach(({ source, target }) => {
      createEdgeToEachSuccessor(graph, source, target)
    })

    deleteUnusedPredecessors(graph, node)
    graph.removeNode(node)
  }
}
