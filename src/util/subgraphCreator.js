import _ from 'lodash'
import { createEdge, setNodeIn } from './rewrite'

export function createSubgraph (graph, context, subgraph) {
  let node, port
  if (_.isObject(subgraph.node)) {
    node = `subgraph_node_${_.uniqueId()}`
    setNodeIn(graph, node, context, subgraph.node)
  } else if (_.isString(subgraph.node)) {
    node = subgraph.node
  } else {
    throw new Error('Unexpected node value ' + subgraph.node)
  }

  if (subgraph.port) {
    port = subgraph.port
  } else {
    const nodeValue = graph.node(node)
    const outputPorts = _.keys(nodeValue.outputPorts || {})
    if (outputPorts.length === 1) {
      port = outputPorts[0]
    } else if (outputPorts.length > 1) {
      throw new Error(`${node} has more than one output port, cannot select one automatically`)
    } // port is intentionally left undefined if there are no output ports
  }

  const predecessors = _.map(subgraph.predecessors || {}, (subgraph, inputPort) => {
    const predecessor = createSubgraph(graph, context, subgraph)
    if (predecessor.port) {
      createEdge(graph, predecessor, { node, port: inputPort })
    } else {
      throw new Error(`${predecessor.node} has no output port`)
    }
    return predecessor
  })

  return { node, port, predecessors }
}

export default createSubgraph
