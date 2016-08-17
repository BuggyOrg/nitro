import { rule, match, replace } from '../rewrite'
import { createEdgeToEachSuccessor, createEdgeFromEachPredecessor, deleteUnusedPredecessors, createEdge, setNodeAt } from '../../util/rewrite'
import { matchInvertableNode, invertNode } from './invertable'
import { constantBool, logicNot } from '../nodes'
import createSubgraph from '../../util/subgraphCreator'

/**
 * Replace a logic/and node with constant inputs with a constant.
 */
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

/**
 * Replace a logic/and node where one input is false with false.
 */
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

/**
 * Remove logic/and if one input is true.
 */
export const replaceAndWithTrue = rule(
  match.byIdAndInputs('logic/and', [ match.constantNode(true), match.any() ]),
  replace.removeNode((graph, node, match) => [{
    fromPort: match.inputs[1].port,
    toPort: Object.keys(graph.node(node).outputPorts)[0]
  }])
)

/**
 * Replace logic/or with constant inputs with a constant.
 */
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

/**
 * Replace a logic/or if one of the inputs is true with true.
 */
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

/**
 * Remove a logic/or node if one of the inputs is false.
 */
export const replaceOrWithFalse = rule(
  match.byIdAndInputs('logic/or', [ match.constantNode(false), match.any() ]),
  replace.removeNode((graph, node, match) => [{
    fromPort: match.inputs[1].port,
    toPort: Object.keys(graph.node(node).outputPorts)[0]
  }])
)

/**
 * Invert constants followed by logic/not.
 */
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

/**
 * Replace ((not a) and (not b)) with (not (a or b)).
 */
export const replaceDeMorganAnd = rule(
  match.byIdAndInputs('logic/and', {
    i1: match.byIdAndInputs('logic/not', { input: match.any() }),
    i2: match.byIdAndInputs('logic/not', { input: match.any() })
  }),
  (graph, node, match) => {
    const newOrNode = `${node}:rewritten:or`
    setNodeAt(graph, newOrNode, node, {
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
    setNodeAt(graph, newNotNode, node, {
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

    createEdgeToEachSuccessor(graph, newNotNode, node)

    createEdgeFromEachPredecessor(graph,
      match.inputs.i1.node,
      { node: newOrNode, port: 'i1' })

    createEdgeFromEachPredecessor(graph,
      match.inputs.i2.node,
      { node: newOrNode, port: 'i2' })

    deleteUnusedPredecessors(graph, node)
    graph.removeNode(node)
  }
)

/**
 * Replace ((not a) or (not b)) with (not (a and b)).
 */
export const replaceDeMorganOr = rule(
  match.byIdAndInputs('logic/or', {
    i1: match.byIdAndInputs('logic/not', { input: match.any() }),
    i2: match.byIdAndInputs('logic/not', { input: match.any() })
  }),
  (graph, node, match) => {
    const newAndNode = `${node}:rewritten:and`
    setNodeAt(graph, newAndNode, node, {
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
    setNodeAt(graph, newNotNode, node, {
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

    createEdgeToEachSuccessor(graph, newNotNode, node)

    createEdgeFromEachPredecessor(graph,
      match.inputs.i1.node,
      { node: newAndNode, port: 'i1' })

    createEdgeFromEachPredecessor(graph,
      match.inputs.i2.node,
      { node: newAndNode, port: 'i2' })

    deleteUnusedPredecessors(graph, node)
    graph.removeNode(node)
  }
)

/**
 * Remove logic/not after invertable nodes and invert the node instead.
 */
export const replaceInvertedInvertable = rule(
  match.byIdAndInputs('logic/not', [
    matchInvertableNode()
  ]),
  (graph, node, match) => {
    const invertedNode = invertNode(graph, match.inputs[0].node)
    createEdgeToEachSuccessor(graph, invertedNode, node)
    deleteUnusedPredecessors(graph, node)
    graph.removeNode(node)
  }
)

/**
 * Replace (not (a and b)) with ((not a) or (not b)) if a and b are invertable.
 */
export const replaceNegatedAndWithInvertableInputs = rule(
  match.byIdAndInputs('logic/not', [
    match.byIdAndInputs('logic/and', [
      matchInvertableNode(),
      matchInvertableNode()
    ])
  ]),
  (graph, node, match) => {
    const newOrNode = `${node}:rewritten:or`
    setNodeAt(graph, newOrNode, node, {
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

    // add inverted inputs
    const invertedInputs = match.inputs[0].inputs
      .map((input) => invertNode(graph, input.node))

    // connect the inverted inputs to the or node
    createEdge(graph, invertedInputs[0], { node: newOrNode, port: 'i1' })
    createEdge(graph, invertedInputs[1], { node: newOrNode, port: 'i2' })

    // connect the or node to the successors of the not node
    createEdgeToEachSuccessor(graph, newOrNode, node)

    deleteUnusedPredecessors(graph, node)
    graph.removeNode(node)
  }
)

/**
 * Replace (not (a or b)) with ((not a) and (not b)) if a and b are invertable.
 */
export const replaceNegatedOrWithInvertableInputs = rule(
  match.byIdAndInputs('logic/not', [
    match.byIdAndInputs('logic/or', [
      matchInvertableNode(),
      matchInvertableNode()
    ])
  ]),
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

    // add inverted inputs
    const invertedInputs = match.inputs[0].inputs
      .map((input) => invertNode(graph, input.node))

    // connect the inverted inputs to the and node
    createEdge(graph, invertedInputs[0], { node: newAndNode, port: 'i1' })
    createEdge(graph, invertedInputs[1], { node: newAndNode, port: 'i2' })

    // connect the or node to the successors of the not node
    createEdgeToEachSuccessor(graph, newAndNode, node)

    deleteUnusedPredecessors(graph, node)
    graph.removeNode(node)
  }
)

/**
 * Remove std/id (identity function).
 */
export const removeId = rule(
  match.byIdAndInputs('std/id'),
  replace.removeNode([{ fromPort: 'input', toPort: 'output' }])
)

/**
 * Remove logic/mux if input1 is true and input2 is false.
 */
export const replaceRedundantMux = rule(
  match.byIdAndInputs('logic/mux', {
    control: match.type('bool'),
    input1: match.constantNode(true),
    input2: match.constantNode(false)
  }),
  (graph, node, match) => {
    createEdgeToEachSuccessor(graph,
      { node: match.inputs.control.node, port: match.inputs.control.inPort },
      node
    )
    deleteUnusedPredecessors(graph, node)
    graph.removeNode(node)
  }
)

/**
 * Replace logic/mux if input1 is false and input2 is true.
 */
export const replaceRedundantInverseMux = rule(
  match.byIdAndInputs('logic/mux', {
    control: match.type('bool'),
    input1: match.constantNode(false),
    input2: match.constantNode(true)
  }),
  (graph, node, match) => {
    const subgraph = createSubgraph(graph, graph.parent(node), {
      node: logicNot(),
      predecessors: {
        input: {
          node: match.inputs.control.node,
          port: match.inputs.control.inPort
        }
      }
    })

    createEdgeToEachSuccessor(graph, subgraph.node, node)
    deleteUnusedPredecessors(graph, node)
    graph.removeNode(node)
  }
)
