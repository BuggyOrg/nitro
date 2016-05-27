import { rule, match, replace } from '../rewrite'
import { copyNode } from '../../util/copy'
import { createEdge, createEdgeToEachSuccessor } from '../../util/rewrite'

export const replaceNonRecursiveApply = rule(
  match.byIdAndInputs('functional/apply', {
    fn: match.lambda({ recursive: false, sideeffects: false }),
    value: match.any()
  }),
  (graph, node, match) => {
    const lamdaImpl = copyNode(graph, graph.children(match.inputs.fn.node)[0])
    graph.setParent(lamdaImpl, graph.parent(node))

    createEdge(graph, match.inputs.value.node, lamdaImpl)
    createEdgeToEachSuccessor(graph, lamdaImpl, node)
    graph.removeNode(node)
  }
)

export const removeUnusedLambda = rule(
  match.sink(match.byIdAndInputs('functional/lambda')),
  replace.removeNode()
)
