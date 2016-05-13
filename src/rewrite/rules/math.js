import { rule, match, replace } from '../rewrite'

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
  })
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
