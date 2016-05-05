import * as match from './matchers'
import * as replace from './replacers'
import rule from './rewriteRule'

export const replaceConstantCalculations = rule(
  match.oneOf(
    match.byIdAndInputs('math/add', { s1: { match: match.constantNode(), alias: 'a' }, s2: { match: match.constantNode(), alias: 'b' } }),
    match.byIdAndInputs('math/multiply', { m1: { match: match.constantNode(), alias: 'a' }, m2: { match: match.constantNode(), alias: 'b' } })
  ),
  replace.withNode((graph, node, match) => {
    return {
      node: {
        id: 'math/const',
        version: '0.2.0',
        inputPorts: {},
        outputPorts: { output: 'number' },
        atomic: true,
        path: [],
        params: { value: graph.node(match.inputs.a.node).params.value + graph.node(match.inputs.b.node).params.value },
        name: 'const'
      },
      rewriteOutputPorts: [{
        oldPort: Object.keys(graph.node(node).outputPorts)[0],
        newNode: 'output'
      }]
    }
  })
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
