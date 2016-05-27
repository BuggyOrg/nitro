import { walk } from '@buggyorg/graphtools'
import { unpackCompoundNode } from '../../util/rewrite'
import { rule } from '../rewrite'

export const removeUnnecessaryCompoundNodes = rule(
  (graph, n) => {
    const node = graph.node(n)
    if (node &&
        !node.recursive &&
        !node.atomic &&
        Object.keys(node.inputPorts || {}).every((p) => walk.predecessor(graph, n, p).length > 0) &&
        Object.keys(node.outputPorts || {}).every((p) => walk.successor(graph, n, p).length > 0)) {
      return { node }
    } else {
      return false
    }
  },
  (graph, node) => unpackCompoundNode(graph, node),
  { name: 'remove unnecessary compound' }
)
