import { rule, match, replace } from '../rewrite'
import { createEdgeToEachSuccessor, createEdgeFromEachPredecessor, deleteUnusedPredecessors, createEdge } from '../../util/rewrite'
import { allEqual } from '../../util/check'
import { constantBool } from '../nodes'

export const replaceConstantCalculations = rule(
  match.oneOf(
    match.byIdAndInputs('math/add', { s1: { match: match.constantNode(), alias: 'a' }, s2: { match: match.constantNode(), alias: 'b' } }),
    match.byIdAndInputs('math/multiply', { m1: { match: match.constantNode(), alias: 'a' }, m2: { match: match.constantNode(), alias: 'b' } })
  ),
  replace.withNode((graph, node, match) => {
    const evaluators = {
      'math/add': (a, b) => a.params.value + b.params.value,
      'math/multiply': (a, b) => a.params.value * b.params.value
    }

    return {
      node: {
        id: 'math/const',
        version: '0.2.0',
        inputPorts: {},
        outputPorts: { output: 'number' },
        atomic: true,
        path: [],
        params: { value: evaluators[graph.node(node).id](graph.node(match.inputs.a.node), graph.node(match.inputs.b.node)) },
        name: 'const'
      },
      rewriteOutputPorts: [{
        oldPort: Object.keys(graph.node(node).outputPorts)[0],
        newPort: 'output'
      }]
    }
  }),
  { name: 'replace constant calculation' }
)

export const replaceMultiplicationWithZero = rule(
  match.byIdAndInputs('math/multiply', [ match.constantNode(0), match.any() ]),
  replace.withNode((graph, node, match) => {
    return {
      node: {
        id: 'math/const',
        version: '0.2.0',
        inputPorts: {},
        outputPorts: { output: 'number' },
        atomic: true,
        path: [],
        params: { value: 0 },
        name: 'const'
      },
      rewriteOutputPorts: [{
        oldPort: Object.keys(graph.node(node).outputPorts)[0],
        newPort: 'output'
      }]
    }
  })
)

export const replaceAdditionWithZero = rule(
  match.byIdAndInputs('math/add', [ match.constantNode(0), match.any() ]),
  replace.removeNode((graph, node, match) => [{
    fromPort: match.inputs[1].port,
    toPort: Object.keys(graph.node(node).outputPorts)[0]
  }])
)

export const replaceMultiplicationWithOne = rule(
  match.byIdAndInputs('math/multiply', [ match.constantNode(1), match.any() ]),
  replace.removeNode((graph, node, match) => [{
    fromPort: match.inputs[1].port,
    toPort: Object.keys(graph.node(node).outputPorts)[0]
  }])
)

export const replaceConstantNumberToString = rule(
  match.byIdAndInputs('translator/number_to_string', { input: match.byIdAndInputs('math/const') }),
  replace.withNode((graph, node, match) => {
    return {
      node: {
        id: 'string/const',
        version: '0.2.0',
        inputPorts: {},
        outputPorts: { output: 'string' },
        atomic: true,
        path: [],
        params: { value: `${graph.node(match.inputs.input.node).params.value}` },
        name: 'const'
      },
      rewriteOutputPorts: [{
        oldPort: 'output',
        newPort: 'output'
      }]
    }
  })
)

export const rewriteMultipleMultiplication = rule(
  (graph, node) => {
    const matcher = match.byIdAndInputs('math/multiply', [
      match.byIdAndInputs('math/multiply', [
        match.byIdAndInputs('math/multiply', [ match.any(), match.any() ]),
        match.any()
      ]),
      match.any()
    ])

    const result = matcher(graph, node)
    if (result !== false) {
      if (allEqual(
        result.inputs[1].node,
        result.inputs[0].inputs[1].node,
        result.inputs[0].inputs[0].inputs[0].node,
        result.inputs[0].inputs[0].inputs[1].node
      )) {
        return result
      }
    }
    return false
  },
  (graph, node, match) => {
    const multiply1 = `${node}:rewritten:m1`
    graph.setNode(multiply1, {
      'id': 'math/multiply',
      'inputPorts': {
        'm1': 'number',
        'm2': 'number'
      },
      'outputPorts': {
        'product': 'bool'
      },
      'atomic': true,
      'version': '0.2.0'
    })
    if (graph.node(node).parent != null) {
      graph.setParent(multiply1, graph.node(node).parent)
    }

    const multiply2 = `${node}:rewritten:m2`
    graph.setNode(multiply2, {
      'id': 'math/multiply',
      'inputPorts': {
        'm1': 'number',
        'm2': 'number'
      },
      'outputPorts': {
        'product': 'bool'
      },
      'atomic': true,
      'version': '0.2.0'
    })
    if (graph.node(node).parent != null) {
      graph.setParent(multiply2, graph.node(node).parent)
    }

    createEdgeFromEachPredecessor(graph,
      { node: match.inputs[0].inputs[0].node, port: match.inputs[0].inputs[0].inputs[0].port },
      { node: multiply1, port: 'm1' })
    createEdgeFromEachPredecessor(graph,
      { node: match.inputs[0].inputs[0].node, port: match.inputs[0].inputs[0].inputs[0].port },
      { node: multiply1, port: 'm2' })

    createEdge(graph,
      multiply1,
      { node: multiply2, port: 'm1' })
    createEdge(graph,
      multiply1,
      { node: multiply2, port: 'm2' })

    createEdgeToEachSuccessor(graph, multiply2, node)

    deleteUnusedPredecessors(graph, node)
    graph.removeNode(node)
  }
)

export const replaceConstantComparison = rule(
  match.oneOf(
    match.byIdAndInputs('math/less', { isLess: match.alias('a', match.constantNode()), than: match.alias('b', match.constantNode()) }),
    match.byIdAndInputs('math/greaterOrEqual', { isGreaterOrEqual: match.alias('a', match.constantNode()), than: match.alias('b', match.constantNode()) })
  ),
  replace.withNode((graph, node, match) => {
    const a = graph.node(match.inputs.a.node).params.value
    const b = graph.node(match.inputs.b.node).params.value
    switch (graph.node(match.node).id) {
      case 'math/less':
        return {
          node: constantBool(a < b),
          rewriteOutputPorts: [{
            oldPort: 'value',
            newPort: 'output'
          }]
        }
      case 'math/greaterOrEqual':
        return {
          node: constantBool(a >= b),
          rewriteOutputPorts: [{
            oldPort: 'value',
            newPort: 'output'
          }]
        }
    }
  })
)
