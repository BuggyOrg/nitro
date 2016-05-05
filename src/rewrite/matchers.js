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
      const match = {}
      const isMatch = Object.keys(inputs).every((inputPort) => {
        let predecessors = atomicPredecessorsOutPort(graph, n, inputPort)
        if (predecessors.length === 1) {
          return predecessors.every(({node, port}) => {
            match[inputPort] = inputs[inputPort](graph, node)
            return match[inputPort] !== false
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
      const match = {}
      match[outputAlias] = { node: n, port: Object.keys(node.outputPorts)[0] }
      return match
    } else {
      return false
    }
  }
}
