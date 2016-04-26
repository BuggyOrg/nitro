import _ from 'lodash'
import graphlib from 'graphlib'
import { walk } from '@buggyorg/graphtools'

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

function deepWalkBack (graph, node, parent = null) {
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

function deepPrintBack (graph, node) {
  let predecessors = deepWalkBack(graph, node)
  while (predecessors.length > 0) {
    console.log(JSON.stringify(predecessors.map(p => graph.node(p.node).id)))
    predecessors = _.flatten(predecessors.map(p => deepWalkBack(graph, p.node, p.successor)))
  }
}

function tryEvaluate (graph, node) {
  let nodeValue = graph.node(node)
  console.log(nodeValue)
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
  graph.sinks().forEach(v => deepPrintBack(graph, v))

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
      let constant = deepWalkBack(graph, node, parent).every(v => isConstant(graph, v.node, v.successor))
      if (constant) {
        const constantNode = createConstantNode(tryEvaluate(graph, node))
        constantNode.branchPath = nodeValue.branchPath
        constantNode.branch = nodeValue.branch
        constantNode.name = nodeValue.name + '-rewritten'

        // rewrite the node
        graph.setNode(node, constantNode)
        graph.nodeEdges(node).filter(e => e.v === node).forEach(e => graph.edge(e).outPort = Object.keys(constantNode.outputPorts)[0])
        graph.nodeEdges(node).filter(e => e.w === node).forEach(e => graph.removeEdge(e))

        console.log(`${node} is constant and was rewritten to ${JSON.stringify(constantNode)}`)
        console.log(JSON.stringify(graphlib.json.write(graph)))

        return deepWalkBack(graph, node, parent).every(v => isConstant(graph, v.node, v.successor))
      } else {
        return false
      }
    }
  }
}
