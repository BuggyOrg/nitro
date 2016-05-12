import _ from 'lodash'
import { walk } from '@buggyorg/graphtools'
import { atomicPredecessorsOutPort, atomicSuccessorsInPort } from './atomicWalk'

export function deleteUnusedPredecessors (graph, node) {
  const nodeValue = graph.node(node)
  Object.keys(nodeValue.inputPorts || {}).forEach((port) => {
    atomicPredecessorsOutPort(graph, node, port).forEach((predecessor) => {
      if (atomicSuccessorsInPort(graph, predecessor.node, predecessor.port).length <= 1) {
        deleteUnusedPredecessors(graph, predecessor.node)
        graph.removeNode(predecessor.node)
      }
    })
  })
}

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

      graph.setEdge(n.node, newNode, {
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

/**
 * Unpacks and removes a compound node.
 * @param graph graph
 * @param n name of the compound node to unpack
 */
export function unpackCompoundNode (graph, node) {
  const nodeValue = graph.node(node)
  let children = graph.children(node)

  // move the compound's children one level up (so that the compound can be safely removed)
  children.forEach((c) => {
    graph.setParent(c, nodeValue.parent)
  })

  // create new input edges for all edges that previosly used the compound node's input ports
  _.flatten(children.map((c) => graph.inEdges(c, node))).forEach((e) => {
    const edge = graph.edge(e)
    walk.predecessorOutPort(graph, node, edge.outPort).forEach((predecessor) => {
      graph.setEdge(e.w, predecessor.node, {
        outPort: predecessor.port,
        inPort: edge.inPort
      }, e.name + '-rewritten')
    })
  })

  // create new output edges for all edges that previously used the compound node's output ports
  _.flatten(children.map((c) => graph.outEdges(c, node))).forEach((e) => {
    const edge = graph.edge(e)
    walk.successorInPort(graph, node, edge.inPort).forEach((successor) => {
      graph.setEdge(e.v, successor.node, {
        outPort: edge.outPort,
        inPort: successor.port
      }, e.name + '-rewritten')
    })
  })

  graph.removeNode(node)
}

export function createEdge (graph, source, target) {
  const edgeName = `${source.node}@${source.port}_to_${target.node}@${target.node}`
  graph.setEdge(source.node, target.node, {
    outPort: source.port,
    inPort: target.port
  }, edgeName)
}

export function createEdgeToEachSuccessor (graph, source, target) {
  walk.successorInPort(graph, target.node, target.port).forEach((target) => {
    createEdge(graph, source, target)
  })
}

export function createEdgeFromEachPredecessor (graph, source, target) {
  walk.predecessorOutPort(graph, source.node, source.port).forEach((source) => {
    createEdge(graph, source, target)
  })
}
