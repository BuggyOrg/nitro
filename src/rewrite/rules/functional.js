import _ from 'lodash'
import { walk } from '@buggyorg/graphtools'
import { rule, match, replace } from '../rewrite'
import { copyNode } from '../../util/copy'
import { createEdgeToEachSuccessor, createEdgeFromEachPredecessor, movePredecessorsInto, deepRemoveNode } from '../../util/rewrite'
import { realPredecessors } from '../../util/realWalk'

export const replaceNonRecursiveApply = rule(
  match.byIdAndInputs('functional/apply', {
    fn: match.lambda({ recursive: false, sideeffects: false }),
    value: match.any()
  }),
  (graph, node, match) => {
    const lamdaImpl = copyNode(graph, graph.children(match.inputs.fn.node)[0])
    graph.setParent(lamdaImpl, graph.parent(node))

    createEdgeFromEachPredecessor(graph, { node: match.node, port: 'value' }, lamdaImpl)
    createEdgeToEachSuccessor(graph, lamdaImpl, node)
    graph.removeNode(node)
  }
)

export const replaceNonRecursivePartial = rule(
  match.byIdAndInputs('functional/partial', {
    fn: match.lambda({ recursive: false, sideeffects: false }),
    value: match.movable(match.any())
  }),
  (graph, node, match) => {
    const valueNode = realPredecessors(graph, node, 'value')[0]

    const newLambda = copyNode(graph, match.inputs.fn.node)
    graph.setParent(newLambda, graph.parent(node))

    createEdgeToEachSuccessor(graph, newLambda, node)

    // move value into the new lambda function
    movePredecessorsInto(graph, { node, port: 'value' }, graph.children(newLambda)[0])

    // connect the moved value to all places where it is needed
    const newLambdaImpl = graph.children(newLambda)[0]
    const partialTargetPort = Object.keys(graph.node(newLambdaImpl).inputPorts)[graph.node(node).params.partial]
    createEdgeToEachSuccessor(graph, valueNode, { node: newLambdaImpl, port: partialTargetPort })

    // remove the old parameter port and edges
    delete graph.node(newLambdaImpl).inputPorts[partialTargetPort]
    graph.nodeEdges(newLambdaImpl).forEach((e) => {
      const edge = graph.edge(e)
      if (edge.outPort === partialTargetPort) {
        graph.removeEdge(e)
      }
    })

    graph.removeNode(node)
  }
)

export const removeUnusedLambda = rule(
  match.sink(match.byIdAndInputs('functional/lambda')),
  replace.removeNode()
)

export const replacePartialPartial = rule(
  match.byIdAndInputs('functional/partial', {
    fn: match.lambda(),
    value: match.byIdAndInputs('functional/partial', {
      fn: match.lambda(),
      value: match.any()
    })
  }),
  (graph, node, match) => {
    const newLambda = copyNode(graph, graph.children(match.inputs.value.inputs.fn.node)[0])
    graph.setParent(newLambda, graph.children(match.inputs.fn.node)[0])

    //deepRemoveNode(graph, match.inputs.value.node)
  }
)
