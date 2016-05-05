import * as match from './matchers'
import rule from './rewriteRule'
import { replaceNode, deleteUnusedPredecessors } from '../util/rewrite'

export const replaceConstantAddition = rule(
  match.byIdAndInputs('math/add', { s1: match.constantNode('s1'), s2: match.constantNode('s2') }),
  (graph, node, { s1, s2 }) => {
    const newNode = {
      id: 'math/const',
      version: '0.2.0',
      inputPorts: {},
      outputPorts: { output: 'number' },
      atomic: true,
      path: [],
      params: { value: graph.node(s1.s1.node).params.value + graph.node(s2.s2.node).params.value },
      name: 'const'
    }

    deleteUnusedPredecessors(graph, node)

    replaceNode(graph, node, newNode, {
      outputPorts: [{
        oldPort: Object.keys(graph.node(node).outputPorts)[0],
        newPort: Object.keys(newNode.outputPorts)[0]
      }]
    })
  }
)
