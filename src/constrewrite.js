
import _ from 'lodash'
import {walk} from '@buggyorg/graphtools'

const knownConstants = {
  'math/const1': (graph, node) => 1
}

const knownNonConstants = {
  'io/stdin': true
}

export function isConstant (graph, node) {
  if (node == null) {
    // a graph is constant if every node that has no successor is constant
    return graph.sinks().every(v => isConstant(graph, v))
  } else {
    // a node is constant if it is a 'known constant' or if every predecessor is constant
    let nodeValue = graph.node(node)
    if (knownConstants[nodeValue.id] != null) {
      // console.log(`- ${nodeValue.id} is a known constant!`)
      return true
    } else if (knownNonConstants[nodeValue.id] != null) {
      // console.log(`- ${nodeValue.id} is a known non-constant`)
      return false
    } else {
      let predecessors = _.flatten(Object.keys(nodeValue.inputPorts || {}).map(port => walk.predecessor(graph, node, port)))
      if (predecessors.every(v => isConstant(graph, v))) {
        // console.log(`- ${nodeValue.id} is constant!`)
        return true
      } else {
        // console.log(`- ${nodeValue.id} is not constant`)
        return false
      }
    }
  }
}
