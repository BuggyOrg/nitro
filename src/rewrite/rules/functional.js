import _ from 'lodash'
import { walk } from '@buggyorg/graphtools'
import { rule, match } from '../rewrite'
import { copyNode } from '../../util/copy'
import { createEdgeToEachSuccessor, movePredecessorsInto, deepRemoveNode, createEdge, deleteUnusedPredecessors } from '../../util/rewrite'
import { realPredecessors } from '../../util/realWalk'
import { findDeep } from '../../util/object'
import { getInputPorts } from '../../util/graph'

/**
 * Replace calls of known lambda functions with the implementation.
 */
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

/**
 * Replace lambda functions followed by functional/partial with a new lambda
 * function that has the bound value inlined.
 */
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

/**
 * Replace partial nodes followed by a call with a new lambda node that has all
 * bound values inlined.
 */
export const replaceCallAfterPartial = rule(
  (graph, node) => {
    let matchLambdaOrPartial
    matchLambdaOrPartial = match.oneOf(
      match.lambda(),
      match.byIdAndInputs('functional/partial', {
        fn: (graph, node) => matchLambdaOrPartial(graph, node),
        value: match.any({ requireNode: false })
      })
    )

    return match.byIdAndInputs('functional/call', {
      fn: match.byIdAndInputs('functional/partial', {
        fn: matchLambdaOrPartial,
        value: match.any({ requireNode: false })
      })
    })(graph, node)
  },
  (graph, node, match) => {
    const lambdaNode = findDeep(
      match.inputs.fn.inputs.fn,
      ({node}) => graph.node(node).id === 'functional/lambda',
      (obj) => obj.inputs.fn
    ).node

    const lamdaImpl = copyNode(graph, graph.children(lambdaNode)[0])
    graph.setParent(lamdaImpl, graph.parent(node))
    createEdgeToEachSuccessor(graph, lamdaImpl, node)

    // connect all partial values to the new lambda function
    let boundValues = []
    findDeep(
      match.inputs.fn,
      ({node}) => graph.node(node).id === 'functional/lambda',
      (obj) => {
        const { node } = obj
        const parameterIndex = graph.node(node).params.partial
        boundValues.push({ value: walk.predecessor(graph, node, 'value')[0], parameterIndex })
        return obj.inputs.fn
      }
    )
    // take care of the indices (i.e. argument 0 of a function that was partial-ed once is actually argument 1)
    const lambdaInputPorts = getInputPorts(graph, lamdaImpl)
    const parameterIndices = _.range(boundValues.length)
    _.forEachRight(boundValues, ({ value, parameterIndex }) => {
      const targetPort = lambdaInputPorts[parameterIndices[parameterIndex]]
      parameterIndices.splice(parameterIndex, 1)
      createEdge(graph, value, { node: lamdaImpl, port: targetPort })
    })

    deleteUnusedPredecessors(graph, node)
    graph.removeNode(node)
  }
)

/**
 * Replace lambda functions that are bound to another lambda function that
 * is bound to one argument with a new lambda function that combines both
 * function and is bound to the argument.
 */
export const replacePartialPartial = rule(
  match.byIdAndInputs('functional/partial', {
    fn: match.lambda(),
    value: match.byIdAndInputs('functional/partial', {
      fn: match.lambda({ outputPorts: 1, inputPorts: 1 }),
      value: match.any({ requireNode: false })
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
