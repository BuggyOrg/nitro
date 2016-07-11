import _ from 'lodash'
import { walk } from '@buggyorg/graphtools'
import { rule, match } from '../rewrite'
import { createEdgeToEachSuccessor, deleteUnusedPredecessors } from '../../util/rewrite'
import * as nodeCreators from '../nodes'
import createSubgraph from '../../util/subgraphCreator'

export const replaceHeadAfterMap = rule(
  match.once(match.byIdAndInputs('array/first', {
    array: match.byIdAndInputs('map', {
      list: match.any({ requireNode: false }),
      fn: match.any({ requireNode: false })
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
                array: walk.predecessor(graph, match.inputs.array.node, 'list')[0]
              }
            },
            fn: walk.predecessor(graph, match.inputs.array.node, 'fn')[0]
          }
        }
      }
    })

    createEdgeToEachSuccessor(graph, subgraph.node, match.node)

    deleteUnusedPredecessors(graph, match.node)
    graph.removeNode(match.node)
  }
)
