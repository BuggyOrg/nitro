import _ from 'lodash'
import { walk } from '@buggyorg/graphtools'

export function deepWalkBack (graph, node, parent = null) {
  let nodeValue = graph.node(node)

  if (nodeValue.atomic) {
    let predecessors = _.flatten(Object.keys(nodeValue.inputPorts || {}).map(port => walk.predecessor(graph, node, port)))

    return _.flatten(predecessors.map(p => {
      if (p === parent) {
        return _.flatten(Object.keys(graph.node(p).inputPorts || {}).map(port => walk.predecessor(graph, p, port)))
          .map(p => {
            return { node: p, successor: node }
          })
      } else {
        return { node: p, successor: node }
      }
    }))
  } else {
    let predecessors = _.flatten(Object.keys(nodeValue.outputPorts || {}).map(port => walk.predecessorOutPort(graph, node, port)))
      .map(n => n.node)
      .filter(n => n !== parent)
    return predecessors.map(p => {
      return { node: p, successor: node }
    })
  }
}

export function deepPrintBack (graph, node) {
  let predecessors = deepWalkBack(graph, node)
  while (predecessors.length > 0) {
    predecessors = _.flatten(predecessors.map(p => deepWalkBack(graph, p.node, p.successor)))
  }
}
