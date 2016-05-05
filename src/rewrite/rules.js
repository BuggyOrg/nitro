import * as match from './matchers'
import * as replace from './replacers'
import rule from './rewriteRule'

export const replaceConstantAddition = rule(
  match.byIdAndInputs('math/add', { s1: match.constantNode('s1'), s2: match.constantNode('s2') }),
  replace.withNode((graph, node, match) => {
    return {
      node: {
        id: 'math/const',
        version: '0.2.0',
        inputPorts: {},
        outputPorts: { output: 'number' },
        atomic: true,
        path: [],
        params: { value: graph.node(match.inputs.s1.node).params.value + graph.node(match.inputs.s2.node).params.value },
        name: 'const'
      },
      rewriteOutputPorts: {
        sum: 'output'
      }
    }
  })
)

export const replaceConstantNumberToString = rule(
  match.byIdAndInputs('translator/number_to_string', { input: match.byIdAndInputs('math/const', {}) }),
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
      rewriteOutputPorts: {
        output: 'output'
      }
    }
  })
)
