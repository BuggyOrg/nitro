import { rule, match, replace } from '../rewrite'

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

// TODO remove multiple nodes and re-connect the ports
/*
export const replaceDoubleNegation = rule(
  match.byIdAndInputs('logic/not', { input: match.byIdAndInputs('logic/not', { input: match.any() }) }),
  replace.removeNode((graph, node, match) => [{
    fromPort: match.inputs.input.inputs.input.port,
    toPort: Object.keys(graph.node(node).outputPorts)[0]
  }])
)
*/
