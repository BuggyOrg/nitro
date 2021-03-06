import _ from 'lodash'
import { walk } from '@buggyorg/graphtools'
import { atomicSuccessorsInPort } from './atomicWalk'

/**
 * Get the type input port of the given node.
 * @param graph graphlib graph
 * @param input node name
 * @returns object with node name and port
 */
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

/**
 * Get the output port of the given node.
 * @param graph graphlib graph
 * @param output node name
 * @returns object with node name and port
 */
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
 * @returns the name of the node that was set
 */
export function setNodeAt (graph, node, contextNode, value) {
  return setNodeIn(graph, node, graph.parent(contextNode), value)
}

/**
 * Sets the value of the given node in the given graph and sets
 * the parent to the given parent node.
 * @param graph graph
 * @param node name of the node to set
 * @param parentNode new parent of the modified node
 * @param value value to set the node to
 * @returns the name of the node that was set
 */
export function setNodeIn (graph, node, parentNode, value) {
  graph.setNode(node, value)
  graph.setParent(node, parentNode)
  return node
}

/**
 * Removes all predecessors of a node that are only used by that
 * node or predecessors of it.
 * @param graph graph
 * @param node name of the node to remove all unused predecessors of
 */
export function deleteUnusedPredecessors (graph, node) {
  if ((graph.node(graph.parent(graph.parent(node))) || {}).id !== 'functional/lambda') {
    const nodeValue = graph.node(node)
    Object.keys(nodeValue.inputPorts || {}).forEach((port) => {
      walk.predecessor(graph, node, port).forEach((predecessor) => {
        if (graph.parent(node) === predecessor.node) {
          // this is an input port of a parent node
          const successors = atomicSuccessorsInPort(graph, predecessor.node, predecessor.port)
          if (successors.length <= 1 || successors.every((s) => s.node === node)) {
            deepRemoveNode(graph, predecessor.node)
          }
        } else {
          // real predecessor node
          const successors = atomicSuccessorsInPort(graph, predecessor.node, predecessor.port)
          if (successors.length <= 1 || successors.every((s) => s.node === node)) {
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
 * Checks if the given compound node is not required in the given graph.
 * @param graph graph
 * @param n name of the compound node to check
 * @returns true if the node is unnecessary, false if not
 */
export function isUnnecessaryCompound (graph, n) {
  const node = graph.node(n)
  const parent = graph.node(graph.parent(n))
  if (node &&
      !node.recursive && !node.recursesTo && !node.recursiveRoot &&
      !node.atomic &&
      node.id !== 'functional/lambda' &&
      !(parent && parent.id === 'functional/lambda')) {
      // Object.keys(node.inputPorts || {}).every((p) => walk.predecessor(graph, n, p).length > 0) &&
      // Object.keys(node.outputPorts || {}).every((p) => walk.successor(graph, n, p).length > 0)) {
    return true
  } else {
    return false
  }
}

/**
 * Unpacks and removes a compound node.
 * @param graph graph
 * @param node name of the compound node to unpack
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

/**
 * Create an edge between two nodes.
 * @param graph graphlib graph
 * @param source source node name or node-port object
 * @param target target node name or node-port object
 */
export function createEdge (graph, source, target) {
  source = getOutputPort(graph, source)
  target = getInputPort(graph, target)

  const edgeName = `${source.node}@${source.port}_to_${target.node}@${target.port}`
  graph.setEdge(source.node, target.node, {
    outPort: source.port,
    inPort: target.port
  }, edgeName)
}

/**
 * Create edges from the given source to every successor of the given target.
 * @param graph graphlib graph
 * @param source source node name or node-port object
 * @param target target node name or node-port object
 */
export function createEdgeToEachSuccessor (graph, source, target) {
  source = getOutputPort(graph, source)
  target = getOutputPort(graph, target)

  walk.successor(graph, target.node, target.port).forEach((target) => {
    createEdge(graph, source, target)
  })
}

/**
 * Create edges from each predecessor of the given source to the given target.
 * @param graph graphlib graph
 * @param source source node name or node-port object
 * @param target target node name or node-port object
 */
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
  const nodeValue = graph.node(node)
  const predecessors = _.flattenDeep(Object.keys(nodeValue.inputPorts || {}).map((port) => walk.predecessor(graph, node, port)))

  const removeNodeAndChildren = (n) => {
    graph.children(n).forEach((c) => removeNodeAndChildren(c))
    graph.removeNode(n)
  }
  removeNodeAndChildren(node)

  predecessors.forEach((predecessor) => {
    if (graph.parent(node) === predecessor.node) {
      // this is an input port of a parent node
      const successors = atomicSuccessorsInPort(graph, predecessor.node, predecessor.port)
      if (successors.length === 0 || successors.every((s) => s.node === node)) {
        deepRemoveNode(graph, predecessor.node)
      }
    } else {
      // real predecessor node
      const successors = atomicSuccessorsInPort(graph, predecessor.node, predecessor.port)
      if (successors.length === 0 || successors.every((s) => s.node === node)) {
        deepRemoveNode(graph, predecessor.node)
        graph.removeNode(predecessor.node)
      }
    }
  })
}

/**
 * Move all predecessor of the given node and port into the given target node.
 * @param graph graphlib graph
 * @param node node name
 * @param port input port name
 * @param target target node name
 */
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

/**
 * Move the given node and all predecessors into the given target node.
 * @param graph graphlib graph
 * @param node node name
 * @param target target node name
 */
export function moveNodeInto (graph, node, target) {
  graph.setParent(node, target)
  Object.keys(graph.node(node).inputPorts || {}).forEach((port) => {
    movePredecessorsInto(graph, { node, port }, target)
  })
}

/**
 * Remove all edges between from given source to the given target.
 * @param graph graphlib graph
 * @param source source node name or node-port object
 * @param target target node name or node-port object
 */
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

/**
 * Remove all edges from and to a specific port of a node.
 * @param graph graphlib graph
 * @param node node name
 * @param port port name
 */
export function removeEdges (graph, node, port) {
  graph.nodeEdges(node).forEach((e) => {
    const edge = graph.edge(e)
    if (edge) {
      if (e.v === node && e.outPort === port) {
        graph.removeEdge(e)
      } else if (e.w === node && e.inPort === port) {
        graph.removeEdge(e)
      }
    }
  })
}

/**
 * Remove a port and all edges from or to that port from a node.
 * @param graph graphlib graph
 * @param n node name
 * @param port port name
 */
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

/**
 * Create an input port with the given name and type on a node.
 * @param graph graphlib graph
 * @param n node name
 * @param port name of the port to create
 * @param type type of the port to create
 */
export function createInputPort (graph, n, port, type) {
  const node = graph.node(n)
  if (!node.inputPorts) {
    node.inputPorts = {}
  }
  node.inputPorts[port] = type

  node.settings = node.settings || {}
  node.settings.argumentOrdering = node.settings.argumentOrdering || []
  node.settings.argumentOrdering.push(port)

  return port
}

/**
 * Create an output port with the given name and type on a node.
 * @param graph graphlib graph
 * @param n node name
 * @param port name of the port to create
 * @param type type of the port to create
 */
export function createOutputPort (graph, n, port, type) {
  const node = graph.node(n)
  if (!node.outputPorts) {
    node.outputPorts = {}
  }
  node.outputPorts[port] = type

  node.settings = node.settings || {}
  node.settings.argumentOrdering = node.settings.argumentOrdering || []
  node.settings.argumentOrdering.push(port)

  return port
}

/**
 * Rename a port of a node. If the port doesn't exist, this is a no-op.
 * @param graph a graphlib graph
 * @param n a node name
 * @param port the old port name
 * @param newName the new port name
 */
export function renamePort (graph, n, port, newName) {
  const node = graph.node(n)

  if (node.inputPorts && node.inputPorts[port]) {
    node.inputPorts[newName] = node.inputPorts[port]
    delete node.inputPorts[port]
  } else if (node.outputPorts) {
    node.outputPorts[newName] = node.outputPorts[port]
    delete node.outputPorts[port]
  } else {
    return
  }

  if (node.settings && node.settings.argumentOrdering) {
    node.settings.argumentOrdering = node.settings.argumentOrdering.map((a) => a === port ? newName : a)
  }

  graph.nodeEdges(n).forEach((e) => {
    const edge = graph.edge(e)
    if (e.v === n && edge.outPort === port) {
      edge.outPort = newName
    } else if (e.w === n && edge.inPort === port) {
      edge.inPort = newName
    }
  })
}

/**
 * Try to get an input port of a node.
 * @param graph graphlib graph
 * @param n node name
 * @param port port name
 * @returns the type of the input port or undefined if the input port doesn't exist
 */
export function tryGetInputPort (graph, n, port) {
  return (graph.node(n).inputPorts || {})[port]
}
