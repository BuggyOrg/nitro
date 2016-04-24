
import _ from 'lodash'
import {walk} from '@buggyorg/graphtools'

const knownConstants = {
  'math/const': (graph, node) => graph.node(node).params.value
}

const knownNonConstants = {
  'io/stdin': true
}

function deepWalkBack (graph, node, parent = null, depth = 0) {
  // TODO this function shouldn't return the entire graph but only walk one step back

  const prefix = Array(depth + 1).join('-')
  let nodeValue = graph.node(node)
  console.log(`${prefix}> deep walk back from ${node} (${nodeValue.atomic ? 'atomic' : 'non-atomic'})`)

  if (nodeValue.atomic) {
    let predecessors = _.flatten(Object.keys(nodeValue.inputPorts || {}).map(port => walk.predecessor(graph, node, port)))
                        // .filter(n => n !== parent)
    return {
      node: node,
      predecessors: _.flatten(predecessors.map(p => {
        if (p === parent) {
          return _.flatten(Object.keys(graph.node(p).inputPorts || {}).map(port => walk.predecessor(graph, p, port))).map(n => deepWalkBack(graph, n, null, depth + 1))
        } else {
          return deepWalkBack(graph, p, depth + 1)
        }
      }))
    }
  } else {
    let predecessors = _.flatten(Object.keys(nodeValue.outputPorts || {}).map(port => walk.predecessorOutPort(graph, node, port)))
                        .map(n => n.node)
                        .filter(n => n !== parent)
    return predecessors.map(p => deepWalkBack(graph, p, node, depth + 1))
  }
}

function isConstantCompound (compoundNode, graph, node, port) {
  let nodeValue = graph.node(node)
  if (nodeValue.atomic) {
    let predecessors = _.flatten(Object.keys(nodeValue.inputPorts || {}).map(port => walk.predecessor(graph, node, port)))
                        .filter(n => n !== compoundNode)
    return predecessors.every(n => isConstantCompound(compoundNode, graph, n))
  } else {
    console.log(`${node} is not atomic`)
    console.log(walk.predecessorOutPort(graph, node, port))

    let predecessors = _.flatten(Object.keys(nodeValue.inputPorts || {}).map(port => walk.predecessorOutPort(graph, node, port)))
                        .map(n => n.node)
                        .filter(n => n !== compoundNode)
    return predecessors.every(n => isConstantCompound(graph, n))
  }
}

export function isConstant (graph, node) {
  if (node == null) {
    // a graph is constant if every node that has no successor is constant
    console.log(JSON.stringify(deepWalkBack(graph, graph.sinks()[0])))
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
      if (!nodeValue.atomic) {
        console.log(`${node} is not atomic`)
        // let predecessors = _.flatten(Object.keys(nodeValue.outputPorts || {}).map(port => walk.predecessorOutPort(graph, node, port)))
        // console.log(predecessors)
        // return predecessors.every(v => isConstantCompound(node, graph, v.node, v.port))
        return isConstantCompound(graph, node)
      } else {
        let predecessors = _.flatten(Object.keys(nodeValue.inputPorts || {}).map(port => walk.predecessor(graph, node, port)))

        console.log(`predecessors of ${node}: ${JSON.stringify(predecessors)}`)
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
}
