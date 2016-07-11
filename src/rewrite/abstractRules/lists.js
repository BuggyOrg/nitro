import _ from 'lodash'
import { rule, match } from '../rewrite'
import { createEdgeToEachSuccessor, deleteUnusedPredecessors } from '../../util/rewrite'
import * as nodeCreators from '../nodes'
import createSubgraph from '../../util/subgraphCreator'

export const replaceHeadAfterMap = rule(
  match.once(match.byIdAndInputs('array/first', {
    array: match.byIdAndInputs('map', {
      list: match.any(),
      fn: match.any()
    })
  })),
  (graph, node, match) => {
    const subgraph = createSubgraph(graph, graph.parent(node), {
      node: nodeCreators.call(),
      predecessors: {
        fn: {
          node: nodeCreators.partial(),
          predecessors: {
            value: {
              node: nodeCreators.arrayFirst(),
              predecessors: {
                array: {
                  node: match.inputs.array.inputs.list.node,
                  port: match.inputs.array.inputs.list.inPort
                }
              }
            },
            fn: {
              node: match.inputs.array.inputs.fn.node,
              port: match.inputs.array.inputs.fn.inPort
            }
          }
        }
      }
    })

    createEdgeToEachSuccessor(graph, subgraph.node, match.node)

    deleteUnusedPredecessors(graph, match.node)
    graph.removeNode(match.node)
  }
)
