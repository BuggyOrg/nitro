import _ from 'lodash'
import { deepWalkBack } from './util/walk'
import { replaceNode } from './util/rewrite'

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
    return tryEvaluate(graph, predecessors[0].node) + tryEvaluate(graph, predecessors[1].node)
  },
  'translator/number_to_string': (graph, node) => `${tryEvaluate(graph, graph.predecessors(node)[0])}`
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
  // TODO create boolean, array and object constants
  if (_.isNumber(constant)) {
    return {
      id: 'math/const',
      version: '0.2.0',
      inputPorts: {},
      outputPorts: { output: 'number' },
      atomic: true,
      path: [],
      params: { value: constant },
      name: 'const'
    }
  } else if (_.isString(constant)) {
    // TODO actual component for string constants might be different later
    return {
      id: 'string/const',
      version: '0.2.0',
      inputPorts: {},
      outputPorts: { output: 'string' },
      atomic: true,
      path: [],
      params: { value: constant },
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

        let deletePredecessors = (graph, node, parent) => deepWalkBack(graph, node, parent).forEach(n => {
          if (graph.successors(n.node).length <= 1) {
            deletePredecessors(graph, n.node, node)
            graph.removeNode(n.node)
          }
        })
        deletePredecessors(graph, node, parent)

        replaceNode(graph, node, constantNode, {
          outputPorts: [{
            oldPort: Object.keys(nodeValue.outputPorts)[0],
            newPort: Object.keys(constantNode.outputPorts)[0]
          }]
        })

      // console.log(`${node} is constant and was rewritten to ${JSON.stringify(constantNode)}`)
      }
    }
  }
}
