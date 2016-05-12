import { rule, match, replace } from '../rewrite'
import { createEdgeToEachSuccessor, createEdgeFromEachPredecessor, deleteUnusedPredecessors, createEdge } from '../../util/rewrite'

function constantBool (value) {
  return {
    id: 'math/const',
    version: '0.2.0',
    inputPorts: {},
    outputPorts: { output: 'bool' },
    atomic: true,
    path: [],
    params: { value },
    name: 'const'
  }
}

export const replaceConstantAnd = rule(
  match.byIdAndInputs('logic/and', { i1: match.constantNode(), i2: match.constantNode() }),
  replace.withNode((graph, node, match) => {
    return {
      node: constantBool(graph.node(match.inputs.i1.node).params.value && graph.node(match.inputs.i2.node).params.value),
      rewriteOutputPorts: [{
        oldPort: 'and',
        newPort: 'output'
      }]
    }
  })
)

export const replaceFalseAnd = rule(
  match.oneOf(
    match.byIdAndInputs('logic/and', { i1: match.constantNode(false), i2: match.any() }),
    match.byIdAndInputs('logic/and', { i1: match.any(), i2: match.constantNode(false) })
  ),
  replace.withNode((graph, node, match) => {
    return {
      node: constantBool(false),
      rewriteOutputPorts: [{
        oldPort: 'and',
        newPort: 'output'
      }]
    }
  })
)

export const replaceConstantOr = rule(
  match.byIdAndInputs('logic/or', { i1: match.constantNode(), i2: match.constantNode() }),
  replace.withNode((graph, node, match) => {
    return {
      node: constantBool(graph.node(match.inputs.i1.node).params.value || graph.node(match.inputs.i2.node).params.value),
      rewriteOutputPorts: [{
        oldPort: 'or',
        newPort: 'output'
      }]
    }
  })
)

export const replaceTrueOr = rule(
  match.oneOf(
    match.byIdAndInputs('logic/or', { i1: match.constantNode(true), i2: match.any() }),
    match.byIdAndInputs('logic/or', { i1: match.any(), i2: match.constantNode(true) })
  ),
  replace.withNode((graph, node, match) => {
    return {
      node: constantBool(true),
      rewriteOutputPorts: [{
        oldPort: 'or',
        newPort: 'output'
      }]
    }
  })
)

export const replaceConstantNot = rule(
  match.byIdAndInputs('logic/not', { input: match.constantNode() }),
  replace.withNode((graph, node, match) => {
    const input = graph.node(match.inputs.input.node).params.value
    return {
      node: constantBool(!input),
      rewriteOutputPorts: [{
        oldPort: 'output',
        newPort: 'output'
      }]
    }
  })
)

export const replaceDoubleNegation = rule(
  match.byIdAndInputs('logic/not', { input: match.byIdAndInputs('logic/not', { input: match.any() }) }),
  replace.bridgeOver((graph, node, match) => {
    return [{
      source: {
        node: match.inputs.input.inputs.input.node,
        port: 'output'
      },
      target: {
        node: node,
        port: 'output'
      }
    }]
  })
)

export const replaceDeMorganAnd = rule(
  match.byIdAndInputs('logic/and', {
    i1: match.byIdAndInputs('logic/not', { input: match.any() }),
    i2: match.byIdAndInputs('logic/not', { input: match.any() })
  }),
  (graph, node, match) => {
    const newOrNode = `${node}:rewritten:or`
    graph.setNode(newOrNode, {
      'id': 'logic/or',
      'inputPorts': {
        'i1': 'bool',
        'i2': 'bool'
      },
      'outputPorts': {
        'or': 'bool'
      },
      'atomic': true,
      'version': '0.1.0'
    })

    const newNotNode = `${node}:rewritten:not`
    graph.setNode(newNotNode, {
      'id': 'logic/not',
      'inputPorts': {
        'input': 'bool'
      },
      'outputPorts': {
        'output': 'bool'
      },
      'atomic': true,
      'version': '0.1.0'
    })

    createEdge(graph, newOrNode, newNotNode)

    createEdgeToEachSuccessor(graph,
      { node: newNotNode, port: 'output' },
      { node: node, port: 'and' })

    createEdgeFromEachPredecessor(graph, {
      node: match.inputs.i1.node,
      port: 'input'
    }, {
      node: newOrNode,
      port: 'i1'
    })

    createEdgeFromEachPredecessor(graph, {
      node: match.inputs.i2.node,
      port: 'input'
    }, {
      node: newOrNode,
      port: 'i2'
    })

    deleteUnusedPredecessors(graph, node)
    graph.removeNode(node)
  }
)


export const replaceDeMorganOr = rule(
  match.byIdAndInputs('logic/or', {
    i1: match.byIdAndInputs('logic/not', { input: match.any() }),
    i2: match.byIdAndInputs('logic/not', { input: match.any() })
  }),
  (graph, node, match) => {
    const newAndNode = `${node}:rewritten:and`
    graph.setNode(newAndNode, {
      'id': 'logic/and',
      'inputPorts': {
        'i1': 'bool',
        'i2': 'bool'
      },
      'outputPorts': {
        'and': 'bool'
      },
      'atomic': true,
      'version': '0.1.0'
    })

    const newNotNode = `${node}:rewritten:not`
    graph.setNode(newNotNode, {
      'id': 'logic/not',
      'inputPorts': {
        'input': 'bool'
      },
      'outputPorts': {
        'output': 'bool'
      },
      'atomic': true,
      'version': '0.1.0'
    })

    createEdge(graph, newAndNode, newNotNode)

    createEdgeToEachSuccessor(graph,
      { node: newNotNode, port: 'output' },
      { node: node, port: 'and' })

    createEdgeFromEachPredecessor(graph, {
      node: match.inputs.i1.node,
      port: 'input'
    }, {
      node: newAndNode,
      port: 'i1'
    })

    createEdgeFromEachPredecessor(graph, {
      node: match.inputs.i2.node,
      port: 'input'
    }, {
      node: newAndNode,
      port: 'i2'
    })

    deleteUnusedPredecessors(graph, node)
    graph.removeNode(node)
  }
)
