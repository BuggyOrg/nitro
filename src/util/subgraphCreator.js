import _ from 'lodash'
import { createEdge, setNodeIn } from './rewrite'

/**
 * Create a subgraph inside the given context node.
 * @param graph graphlib graph
 * @param context parent node to insert the subgraph into
 * @param subgraph subgraph specification
 * @param type whether to create the new nodes as predecessors or successors
 * @returns object with the node, port, predecessors and successors of the created subgraph
 */
function createSubgraph (graph, context, subgraph, type = 'predecessor') {
  let node, port
  if (_.isObject(subgraph.node)) {
    node = `subgraph_node_${_.uniqueId()}`
    setNodeIn(graph, node, context, subgraph.node)
  } else if (_.isString(subgraph.node)) {
    node = subgraph.node
  } else if (_.isString(subgraph)) {
    node = subgraph
  } else {
    throw new Error('Unexpected node value ' + subgraph.node)
  }

  if (subgraph.port) {
    port = subgraph.port
  } else {
    const nodeValue = graph.node(node)
    if (type === 'predecessor') {
      const outputPorts = _.keys(nodeValue.outputPorts || {})
      if (outputPorts.length === 1) {
        port = outputPorts[0]
      } else if (outputPorts.length > 1) {
        throw new Error(`${node} has more than one output port, cannot select one automatically`)
      } // port is intentionally left undefined if there are no output ports
    } else {
      const inputPorts = _.keys(nodeValue.inputPorts || {})
      if (inputPorts.length === 1) {
        port = inputPorts[0]
      } else if (inputPorts.length > 1) {
        throw new Error(`${node} has more than one input port, cannot select one automatically`)
      } // port is intentionally left undefined if there are no output ports
    }
  }

  const predecessors = _.map(subgraph.predecessors || {}, (subgraph, inputPort) => {
    const predecessor = createSubgraph(graph, context, subgraph, 'predecessor')
    if (predecessor.port) {
      createEdge(graph, predecessor, { node, port: inputPort })
    } else {
      throw new Error(`${predecessor.node} has no output port`)
    }
    return predecessor
  })

  const successors = _.map(subgraph.successors || {}, (subgraph, outputPort) => {
    const successor = createSubgraph(graph, context, subgraph, 'successor')
    if (successor.port) {
      createEdge(graph, { node, port: outputPort }, successor)
    } else {
      throw new Error(`${successor.node} has no input port`)
    }
    return successor
  })

  return { node, port, predecessors, successors }
}

/**
 * Create a subgraph inside the given context node.
 * @param graph graphlib graph
 * @param context parent node to insert the subgraph into
 * @param subgraph subgraph specification
 * @returns object with the node and port of the created subgraph
 */
export default function (graph, context, subgraph) {
  const { node, port } = createSubgraph(graph, context, subgraph, 'predecessor')
  return { node, port }
}
