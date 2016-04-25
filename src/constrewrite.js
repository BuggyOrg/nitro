
import _ from 'lodash'
import {walk} from '@buggyorg/graphtools'

const knownConstants = {
  'math/const': (graph, node) => graph.node(node).params.value
}

const knownNonConstants = {
  'io/stdin': true
}

function deepWalkBack (graph, node, parent = null) {
  let nodeValue = graph.node(node)

  if (nodeValue.atomic) {
    let predecessors = _.flatten(Object.keys(nodeValue.inputPorts || {}).map(port => walk.predecessor(graph, node, port)))

    return _.flatten(predecessors.map(p => {
      if (p === parent) {
        return _.flatten(Object.keys(graph.node(p).inputPorts || {}).map(port => walk.predecessor(graph, p, port)))
                .map(p => { return { node: p, successor: node } })
      } else {
        return { node: p, successor: node }
      }
    }))
  } else {
    let predecessors = _.flatten(Object.keys(nodeValue.outputPorts || {}).map(port => walk.predecessorOutPort(graph, node, port)))
                        .map(n => n.node)
                        .filter(n => n !== parent)
    return predecessors.map(p => { return { node: p, successor: node } })
  }
}

/*
function deepPrintBack (graph, node) {
  let predecessors = deepWalkBack(graph, node)
  while (predecessors.length > 0) {
    console.log(JSON.stringify(predecessors))
    predecessors = _.flatten(predecessors.map(p => deepWalkBack(graph, p.node, p.successor)))
  }
}
*/

export function isConstant (graph, node, parent = null) {
  if (node == null) {
    // a graph is constant if every node that has no successor is constant
    return graph.sinks().every(v => isConstant(graph, v))
  } else {
    // a node is constant if it is a 'known constant' or if every predecessor is constant
    let nodeValue = graph.node(node)
    if (knownConstants[nodeValue.id] != null) {
      console.log(`- ${nodeValue.id} is a known constant!`)
      return true
    } else if (knownNonConstants[nodeValue.id] != null) {
      console.log(`- ${nodeValue.id} is a known non-constant`)
      return false
    } else {
      return deepWalkBack(graph, node, parent).every(v => isConstant(graph, v.node, v.successor))
    }
  }
}
