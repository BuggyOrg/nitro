import * as match from './matchers'
import * as replace from './replacers'
import rule from './rewriteRule'

export const replaceConstantAddition = rule(
  match.byIdAndInputs('math/add', { s1: match.constantNode('s1'), s2: match.constantNode('s2') }),
  replace.withNode((graph, node, { s1, s2 }) => {
    return {
      node: {
        id: 'math/const',
        version: '0.2.0',
        inputPorts: {},
        outputPorts: { output: 'number' },
        atomic: true,
        path: [],
        params: { value: graph.node(s1.s1.node).params.value + graph.node(s2.s2.node).params.value },
        name: 'const'
      },
      rewriteOutputPorts: {
        sum: 'output'
      }
    }
  })
)
