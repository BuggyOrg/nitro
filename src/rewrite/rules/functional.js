import _ from 'lodash'
import { walk } from '@buggyorg/graphtools'
import { rule, match, replace } from '../rewrite'
import { copyNode } from '../../util/copy'
import { createEdgeToEachSuccessor, movePredecessorsInto, deepRemoveNode, createEdge } from '../../util/rewrite'
import { realPredecessors } from '../../util/realWalk'

export const replaceNonRecursiveCall = rule(
  match.byIdAndInputs('functional/call', {
    fn: match.lambda({ recursive: false, sideeffects: false })
  }),
  (graph, node, match) => {
    const lamdaImpl = copyNode(graph, graph.children(match.inputs.fn.node)[0])
    graph.setParent(lamdaImpl, graph.parent(node))
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
      fn: match.lambda({ outputPorts: 1, inputPorts: 1 }),
      value: match.any()
    })
  }),
  (graph, node, match) => {
    const inputFnImpl = graph.children(match.inputs.fn.node)[0]

    const newLambda = copyNode(graph, graph.children(match.inputs.value.inputs.fn.node)[0])
    graph.setParent(newLambda, inputFnImpl)

    const partialTargetPort = Object.keys(graph.node(inputFnImpl).inputPorts)[graph.node(node).params.partial]
    createEdgeToEachSuccessor(graph, newLambda, { node: inputFnImpl, port: partialTargetPort })

    // re-use the now unused input port for the previously partial-ed input
    createEdge(graph,
      { node: graph.children(match.inputs.fn.node)[0], port: Object.keys(graph.node(graph.children(match.inputs.fn.node)[0]).inputPorts)[0] },
      { node: newLambda, port: Object.keys(graph.node(newLambda).inputPorts)[graph.node(match.inputs.value.node).params.partial] }
    )
    graph.node(graph.children(match.inputs.fn.node)[0]).inputPorts[Object.keys(graph.node(graph.children(match.inputs.fn.node)[0]).inputPorts)[0]] = graph.node(newLambda).inputPorts[Object.keys(graph.node(newLambda).inputPorts)[graph.node(match.inputs.value.node).params.partial]]

    // re-connect the value of the matched partial
    createEdgeToEachSuccessor(graph, walk.predecessor(graph, match.inputs.value.node, 'value')[0], match.inputs.value.node)

    // remove old edge
    graph.nodeEdges(inputFnImpl).forEach((e) => {
      const edge = graph.edge(e)
      if (edge && (edge.inPort === partialTargetPort)) {
        graph.removeEdge(e)
      }
    })

    deepRemoveNode(graph, match.inputs.value.node)
  }
)
