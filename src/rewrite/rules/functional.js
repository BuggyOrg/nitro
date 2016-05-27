import { rule, match, replace } from '../rewrite'
import { copyNode } from '../../util/copy'
import { createEdge, createEdgeToEachSuccessor, moveNodeInto } from '../../util/rewrite'

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

export const replaceNonRecursivePartial = rule(
  match.byIdAndInputs('functional/partial', {
    fn: match.lambda({ recursive: false, sideeffects: false }),
    value: match.any() // TODO check if value is moveable
  }),
  (graph, node, match) => {
    const newLambdaImpl = copyNode(graph, graph.children(match.inputs.fn.node)[0])

    const newLambda = `${node}_rewritten`
    graph.setNode(newLambda, {
      id: 'functional/lambda',
      outputPorts: {
        fn: 'function'
      }
    })

    createEdgeToEachSuccessor(graph, newLambda, node)

    // move value into the new lambda function
    moveNodeInto(graph, match.inputs.value.node, newLambdaImpl)
    graph.removeNode(node)
    // TODO

    // graph.setParent(newLambdaImpl, newLambda)
    // graph.setParent(newLambda, graph.parent(node))
  }
)

export const removeUnusedLambda = rule(
  match.sink(match.byIdAndInputs('functional/lambda')),
  replace.removeNode()
)
