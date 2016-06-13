import _ from 'lodash'
import { walk } from '@buggyorg/graphtools'
import { atomicSuccessorsInPort } from './atomicWalk'

function getInputPort (graph, input) {
  if (_.isString(input)) {
    const node = graph.node(input)
    const ports = Object.keys(node.inputPorts || {})
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
    const ports = Object.keys(node.outputPorts || {})
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
    walk.predecessor(graph, node, port).forEach((predecessor) => {
      if (graph.parent(node) === predecessor.node) {
        // this is an input port of a parent node
        if (atomicSuccessorsInPort(graph, predecessor.node, predecessor.port).length <= 1) {
          deepRemoveNode(graph, predecessor.node)
        }
      } else {
        // real predecessor node
        if (atomicSuccessorsInPort(graph, predecessor.node, predecessor.port).length <= 1) {
          deepRemoveNode(graph, predecessor.node)
          graph.removeNode(predecessor.node)
        }
      }

      if (walk.successor(graph, node, port).length <= 1 &&
          walk.predecessor(graph, node, port).length === 0) {
        delete nodeValue.inputPorts[port]
      }
    })
  })
}

/**
 * Removes all unused predecessors of a node that is not used and that
 * node itstelf.
 * @param graph graph
 * @param node name of the node to remove
 */
export function deleteIfUnused (graph, node) {
  const nodeValue = graph.node(node)
  if (nodeValue) {
    // there are valid cases where the node may not exist anymore, i.e. if the
    // node was a predecessor of multiple input port a replaced node
    if (_.flatten(Object.keys(nodeValue.outputPorts || {}).map((port) => atomicSuccessorsInPort(graph, node, port))).length === 0) {
      deleteUnusedPredecessors(graph, node)
      graph.removeNode(node)
    }
  }
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
    walk.predecessor(graph, node, oldPort).forEach(n => {
      const edgeName = `${n.node}@${n.port}_to_${newNode}@${newPort}`

      graph.setEdge(n.node, newNode, {
        outPort: n.port,
        inPort: newPort
      }, edgeName)
    })
  })

  // connect output ports
  ;(portRewrites.outputPorts || []).forEach(({oldPort, newPort}) => {
    walk.successor(graph, node, oldPort).forEach(n => {
      const edgeName = `${newNode}@${newPort}_to_${n.node}@${n.port}`

      graph.setEdge(newNode, n.node, {
        outPort: newPort,
        inPort: n.port
      }, edgeName)
    })
  })

  deleteUnusedPredecessors(graph, node)
  graph.removeNode(node)
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
  Object.keys(graph.node(node).inputPorts || {}).forEach((port) => {
    walk.predecessor(graph, node, port).forEach((predecessor) => {
      walk.successor(graph, node, port).forEach((successor) => {
        createEdge(graph, predecessor, successor)
      })
    })
  })

  // create new output edges for all edges that previously used the compound node's output ports
  Object.keys(graph.node(node).outputPorts || {}).forEach((port) => {
    walk.predecessor(graph, node, port).forEach((predecessor) => {
      walk.successor(graph, node, port).forEach((successor) => {
        createEdge(graph, predecessor, successor)
      })
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

  walk.successor(graph, target.node, target.port).forEach((target) => {
    createEdge(graph, source, target)
  })
}

export function createEdgeFromEachPredecessor (graph, source, target) {
  source = getInputPort(graph, source)
  target = getInputPort(graph, target)

  walk.predecessor(graph, source.node, source.port).forEach((source) => {
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

  const removeNodeAndChildren = (n) => {
    graph.children(n).forEach((c) => removeNodeAndChildren(c))
    graph.removeNode(n)
  }
  removeNodeAndChildren(node)
}

export function movePredecessorsInto (graph, { node, port }, target) {
  walk.predecessor(graph, node, port).forEach((predecessor) => {
    if (graph.parent(node) === predecessor.node) { // this is an input port of a parent node
      // connect predecessors and successors of that port (the predecessors will be moved in the next step, so that's okay)
      const predecessors = walk.predecessor(graph, predecessor.node, predecessor.port)
      predecessors.forEach((predecessorOfPredecessor) => {
        createEdgeToEachSuccessor(graph, predecessorOfPredecessor, predecessor)
      })
      // remove the original edges of that port
      graph.nodeEdges(predecessor.node).forEach((e) => {
        const edge = graph.edge(e)
        if (edge && (edge.inPort === predecessor.port || edge.outPort === predecessor.port)) {
          graph.removeEdge(e)
        }
      })
      // delete the port
      delete graph.node(predecessor.node).inputPorts[predecessor.port]

      // move original predecessors of this node/port (their successors were changed above, but that's okay)
      predecessors.forEach((predecessor) => {
        moveNodeInto(graph, predecessor.node, target)
      })
    } else {
      // real predecessor node
      moveNodeInto(graph, predecessor.node, target)
    }
  })
}

export function moveNodeInto (graph, node, target) {
  graph.setParent(node, target)
  Object.keys(graph.node(node).inputPorts || {}).forEach((port) => {
    movePredecessorsInto(graph, { node, port }, target)
  })
}

export function removeEdge (graph, source, target) {
  source = getOutputPort(graph, source)
  target = getInputPort(graph, target)
  graph.nodeEdges(source.node).forEach((e) => {
    const edge = graph.edge(e)
    if (edge && e.v === source.node && e.w === target.node && edge.outPort === source.port && edge.inPort === target.port) {
      graph.removeEdge(e)
    }
  })
}

export function removePort (graph, n, port) {
  const node = graph.node(n)
  graph.nodeEdges(n).forEach((e) => {
    const edge = graph.edge(e)
    if (edge.outPort === port && e.v === n ||
        edge.inPort === port && e.w === n) {
      graph.removeEdge(e)
    }
  })
  delete node.inputPorts[port]
}
