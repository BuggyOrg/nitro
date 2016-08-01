import { rule, match, replace } from '../rewrite'
import { createEdgeToEachSuccessor, createEdgeFromEachPredecessor, deleteUnusedPredecessors, createEdge, moveNodeInto, removeEdge, setNodeAt } from '../../util/rewrite'
import { allEqual } from '../../util/check'
import { copyNode } from '../../util/copy'
import { constantBool, constantNumber, constantString, multiply } from '../nodes'

export const replaceConstantCalculations = rule(
  match.oneOf(
    match.byIdAndInputs('math/add', { s1: { match: match.constantNode(), alias: 'a' }, s2: { match: match.constantNode(), alias: 'b' } }),
    match.byIdAndInputs('math/sub', { minuend: { match: match.constantNode(), alias: 'a' }, subtrahend: { match: match.constantNode(), alias: 'b' } }),
    match.byIdAndInputs('math/multiply', { m1: { match: match.constantNode(), alias: 'a' }, m2: { match: match.constantNode(), alias: 'b' } })
  ),
  replace.withNode((graph, node, match) => {
    const evaluators = {
      'math/add': (a, b) => a.params.value + b.params.value,
      'math/sub': (a, b) => a.params.value - b.params.value,
      'math/multiply': (a, b) => a.params.value * b.params.value
    }

    return {
      node: constantNumber(evaluators[graph.node(node).id](graph.node(match.inputs.a.node), graph.node(match.inputs.b.node))),
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
      node: constantNumber(0),
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

export const replaceSubtractionByZero = rule(
  match.byIdAndInputs('math/sub', { minuend: match.any(), subtrahend: match.constantNode(0) }),
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
      node: constantString(`${graph.node(match.inputs.input.node).params.value}`),
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
    setNodeAt(graph, multiply1, node, multiply())

    const multiply2 = `${node}:rewritten:m2`
    setNodeAt(graph, multiply2, node, multiply())

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

export const bubbleUpConstant = ['math/add', 'math/multiply', 'logic/and', 'logic/or'].map((operation) => rule(
  match.byIdAndInputs(operation, [
    match.alias('operation', match.movable(match.byIdAndInputs(operation, [ match.alias('constant', match.constantNode()), match.alias('x', match.movable()) ]))),
    match.alias('constant', match.constantNode())
  ]),
  (graph, node, match) => {
    // swap match.inputs.operation.inputs.x and match.inputs.constant

    // copy the constant to the location of 'x'
    const copiedConstant = copyNode(graph, match.inputs.constant.node)
    graph.setParent(copiedConstant, graph.parent(match.inputs.operation.inputs.x.node))

    // move x
    moveNodeInto(graph, match.inputs.operation.inputs.x.node, graph.parent(match.inputs.constant.node))
    graph.nodeEdges(match.inputs.operation.inputs.x.node).forEach((e) => {
      if (e.v === match.inputs.operation.inputs.x.node &&
          e.w === match.inputs.operation.node &&
          graph.edge(e).inPort === match.inputs.operation.inputs.x.port) {
        graph.removeEdge(e)
      }
    })

    // create new edges
    createEdge(graph, copiedConstant, { node: match.inputs.operation.node, port: match.inputs.operation.inputs.x.port })
    createEdge(graph, match.inputs.operation.inputs.x.node, { node: match.node, port: match.inputs.constant.port })

    // cleanup
    removeEdge(graph, match.inputs.constant.node, { node: match.node, port: match.inputs.constant.port })
    if (graph.successors(match.inputs.constant.node).length === 0) {
      graph.removeNode(match.inputs.constant.node)
    }
  }
))

export const replaceConstantEqual = rule(
  match.byIdAndInputs('logic/equal', { i1: match.constantNode(), i2: match.constantNode() }),
  replace.withNode((graph, node, match) => {
    const a = graph.node(match.inputs.i1.node)
    const b = graph.node(match.inputs.i2.node)
    return {
      node: constantBool(a.params.value === b.params.value),
      rewriteOutputPorts: [{
        oldPort: 'eq',
        newPort: 'output'
      }]
    }
  })
)

export const replaceAlwaysTrueComparison = rule(
  match.once(match.oneOf(
    match.byIdAndSameInputs('logic/equal', ['i1', 'i2'], match.any({ requireNode: false })),
    match.byIdAndSameInputs('math/lessOrEqual', ['isLessOrEqual', 'than'], match.any({ requireNode: false })),
    match.byIdAndSameInputs('logic/greaterOrEqual', ['isGreaterOrEqual', 'than'], match.any({ requireNode: false }))
  )),
  replace.withNode((graph, node, match) => {
    return {
      node: constantBool(true),
      rewriteOutputPorts: [{
        oldPort: Object.keys(graph.node(node).outputPorts)[0],
        newPort: 'output'
      }]
    }
  })
)

export const replaceAlwaysFalseComparison = rule(
  match.once(match.oneOf(
    match.byIdAndSameInputs('math/less', ['isLess', 'than'], match.any({ requireNode: false })),
    match.byIdAndSameInputs('logic/greater', ['isGreater', 'than'], match.any({ requireNode: false }))
  )),
  replace.withNode((graph, node, match) => {
    return {
      node: constantBool(false),
      rewriteOutputPorts: [{
        oldPort: Object.keys(graph.node(node).outputPorts)[0],
        newPort: 'output'
      }]
    }
  })
)
