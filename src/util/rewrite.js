import _ from 'lodash'
import { walk } from '@buggyorg/graphtools'
import { atomicPredecessorsOutPort, atomicSuccessorsInPort } from './atomicWalk'

function getInputPort (graph, input) {
  if (_.isString(input)) {
    const node = graph.node(input)
    const ports = Object.keys(node.inputPorts)
    if (ports.length === 1) {
      return {
        node: input,
        port: ports[0]
      }
    } else {
      throw new Error(`input port of node ${input} could not be selected automatically`)
    }
  } else {
    return input
  }
}

function getOutputPort (graph, output) {
  if (_.isString(output)) {
    const node = graph.node(output)
    const ports = Object.keys(node.outputPorts)
    if (ports.length === 1) {
      return {
        node: output,
        port: ports[0]
      }
    } else {
      throw new Error(`output port of node ${output} could not be selected automatically`)
    }
  } else {
    return output
  }
}

/**
 * Sets the value of the given node in the given graph and sets
 * the parent to the same value as the contextNode's parent.
 * @param graph graph
 * @param node name of the node to set
 * @param contextNode node whose parent should become the parent of the modified node
 * @param value value to set the node to
 */
export function setNodeAt (graph, node, contextNode, value) {
  graph.setNode(node, value)
  graph.setParent(node, graph.parent(contextNode))
}

/**
 * Removes all predecessors of a node that are only used by that
 * node or predecessors of it.
 * @param graph graph
 * @param node name of the node to remove all unused predecessors of
 */
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
 * Unpacks and removes a compound node.
 * @param graph graph
 * @param n name of the compound node to unpack
 */
export function unpackCompoundNode (graph, node) {
  let children = graph.children(node)

  // move the compound's children one level up (so that the compound can be safely removed)
  children.forEach((c) => {
    graph.setParent(c, graph.parent(node))
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
  source = getOutputPort(graph, source)
  target = getInputPort(graph, target)

  const edgeName = `${source.node}@${source.port}_to_${target.node}@${target.port}`
  graph.setEdge(source.node, target.node, {
    outPort: source.port,
    inPort: target.port
  }, edgeName)
}

export function createEdgeToEachSuccessor (graph, source, target) {
  source = getOutputPort(graph, source)
  target = getOutputPort(graph, target)

  walk.successorInPort(graph, target.node, target.port).forEach((target) => {
    createEdge(graph, source, target)
  })
}

export function createEdgeFromEachPredecessor (graph, source, target) {
  source = getInputPort(graph, source)
  target = getInputPort(graph, target)

  walk.predecessorOutPort(graph, source.node, source.port).forEach((source) => {
    createEdge(graph, source, target)
  })
}

/**
 * Removes a node and all unused predecessors from a graph.
 * @param graph graph
 * @param node name of the node to remove
 */
export function deepRemoveNode (graph, node) {
  deleteUnusedPredecessors(graph, node)
  graph.removeNode(node)
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
  setNodeAt(graph, newNode, node, newValue)

  // connect input ports
  ;(portRewrites.inputPorts || []).forEach(({oldPort, newPort}) => {
    walk.predecessorOutPort(graph, node, oldPort).forEach(n => {
      createEdge(graph, { node: n.node, port: n.port }, { node: newNode, port: newPort })
    })
  })

  // connect output ports
  ;(portRewrites.outputPorts || []).forEach(({oldPort, newPort}) => {
    walk.successorInPort(graph, node, oldPort).forEach(n => {
      createEdge(graph, { node: newNode, port: newPort }, { node: n.node, port: n.port })
    })
  })

  deleteUnusedPredecessors(graph, node)
  graph.removeNode(node)
}
