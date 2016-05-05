import { atomicPredecessorsOutPort } from '../util/atomicWalk'

export function any (outputAlias) {
  return (graph, n) => {
    const node = graph.node(n)
    const match = {}
    match[outputAlias] = Object.keys(node.outputPorts)[0]
    return match
  }
}

export function byIdAndInputs (id, inputs) {
  return (graph, n) => {
    const node = graph.node(n)
    if (node.id === id) {
      const match = { node: n, inputs: {} }
      const isMatch = Object.keys(inputs).every((inputPort) => {
        let predecessors = atomicPredecessorsOutPort(graph, n, inputPort)
        if (predecessors.length === 1) {
          return predecessors.every(({node, port}) => {
            match.inputs[inputPort] = inputs[inputPort](graph, node)
            return match.inputs[inputPort] !== false
          })
        } else {
          return false
        }
      })
      return isMatch ? match : false
    } else {
      return false
    }
  }
}

export function constantNode (outputAlias) {
  return (graph, n) => {
    const node = graph.node(n)
    if (node.id === 'math/const') {
      const match = { node: n, outputs: {} }
      match.outputs[outputAlias] = Object.keys(node.outputPorts)[0]
      return match
    } else {
      return false
    }
  }
}
