import _ from 'lodash'
import { walk } from '@buggyorg/graphtools'
import { deepWalkBack } from './util/walk'

const knownConstants = {
  'math/const': (graph, node) => graph.node(node).params.value
}

const knownNonConstants = {
  'io/stdin': true
}

const evaluateToConstant = {
  'math/const': (graph, node) => graph.node(node).params.value,
  'math/add': (graph, node) => {
    let parent = graph.node(node).parent
    let predecessors = deepWalkBack(graph, node, parent)
    return tryEvaluate(graph, predecessors[0].node) + tryEvaluate(graph, predecessors[0].node)
  }
}

function tryEvaluate (graph, node) {
  let nodeValue = graph.node(node)
  let evaluator = evaluateToConstant[nodeValue.id]
  if (evaluator != null) {
    return evaluator(graph, node)
  } else {
    throw new Error(`${node} can't be evaluated statically`)
  }
}

function createConstantNode (constant) {
  // TODO create boolean, string and object constants
  if (_.isNumber(constant)) {
    return {
      id: 'math/const',
      version: '0.2.0',
      inputPorts: {},
      outputPorts: { output: 'number' },
      atomic: true,
      path: [],
      params: { value: constant },
      branchPath: 'const',
      branch: 'const',
      name: 'const'
    }
  } else {
    throw new Error('cannot create constant node for ' + constant)
  }
}

export function isConstant (graph, node, parent = null) {
  if (node == null) {
    // a graph is constant if every node that has no successor is constant
    return graph.sinks().every(v => isConstant(graph, v))
  } else {
    // a node is constant if it is a 'known constant' or if every predecessor is constant
    let nodeValue = graph.node(node)
    if (knownConstants[nodeValue.id] != null) {
      return true
    } else if (knownNonConstants[nodeValue.id] != null) {
      return false
    } else {
      return deepWalkBack(graph, node, parent).every(v => isConstant(graph, v.node, v.successor))
    }
  }
}

export function rewriteConstants (graph, node, parent = null) {
  if (node == null) {
    // a graph is constant if every node that has no successor is constant
    graph.sinks().every(v => rewriteConstants(graph, v))
  } else {
    // a node is constant if it is a 'known constant' or if every predecessor is constant
    let nodeValue = graph.node(node)
    if (knownConstants[nodeValue.id] != null) {
      // console.log(`- ${nodeValue.id} is a known constant!`)
    } else if (knownNonConstants[nodeValue.id] != null) {
      // console.log(`- ${nodeValue.id} is a known non-constant`)
    } else {
      let constant = deepWalkBack(graph, node, parent).every(v => {
        const c = isConstant(graph, v.node, v.successor)
        if (c) {
          rewriteConstants(graph, v.node, v.successor)
        }
        return c
      })
      if (constant) {
        let constantNode
        try {
          constantNode = createConstantNode(tryEvaluate(graph, node))
        } catch (e) {
          return
        }

        constantNode.path = nodeValue.path
        constantNode.branchPath = nodeValue.branchPath
        constantNode.branch = nodeValue.branch

        // rewrite the node
        let deletePredecessors = (graph, node, parent) => deepWalkBack(graph, node, parent).forEach(n => {
          deletePredecessors(graph, n.node, node)
          graph.removeNode(n.node)
        })
        deletePredecessors(graph, node, parent)

        const newNode = `${node}:rewritten`
        graph.setNode(newNode, constantNode)
        graph.setParent(newNode, nodeValue.parent)

        Object.keys(nodeValue.outputPorts).forEach(p => {
          walk.successorInPort(graph, node, p).forEach(n => {
            graph.setEdge(newNode, n.node, {
              outPort: Object.keys(constantNode.outputPorts)[0],
              inPort: n.port
            },
              `${newNode}@${Object.keys(constantNode.outputPorts)[0]}_to_${n.node}@${n.port}`)
          })
        })

        graph.removeNode(node)
        // console.log(`${node} is constant and was rewritten to ${JSON.stringify(constantNode)}`)

      // deepWalkBack(graph, newNode, parent).forEach(v => rewriteConstants(graph, v.node, v.successor))
      }
    }
  }
}
