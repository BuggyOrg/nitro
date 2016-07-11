import _ from 'lodash'
import { rule, match } from '../rewrite'
import { createEdgeToEachSuccessor, deleteUnusedPredecessors, createEdge, setNodeAt } from '../../util/rewrite'
import * as nodeCreators from '../nodes'

export const replaceHeadAfterMap = rule(
  match.once(match.byIdAndInputs('array/first', {
    array: match.byIdAndInputs('map', {
      list: match.any(),
      fn: match.any()
    })
  })),
  (graph, node, match) => {
    const partial = `${node}_${_.uniqueId('partial_')}`
    setNodeAt(graph, partial, node, nodeCreators.partial())
    const call = `${node}_${_.uniqueId('call_')}`
    setNodeAt(graph, call, node, nodeCreators.call())
    const first = `${node}_${_.uniqueId('first_')}`
    setNodeAt(graph, first, node, nodeCreators.arrayFirst())

    createEdge(graph, { node: match.inputs.array.inputs.list.node, port: match.inputs.array.inputs.list.inPort }, first)
    createEdge(graph, first, { node: partial, port: 'value' })
    createEdge(graph, { node: match.inputs.array.inputs.fn.node, port: match.inputs.array.inputs.fn.inPort }, { node: partial, port: 'fn' })
    createEdge(graph, partial, call)
    createEdgeToEachSuccessor(graph, call, match.node)

    deleteUnusedPredecessors(graph, match.node)
    graph.removeNode(match.node)
  }
)
