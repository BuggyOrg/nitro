import _ from 'lodash'
import { walk } from '@buggyorg/graphtools'
import { getLambdaFunctionType } from '@buggyorg/functional'
import { rule, match } from '../rewrite'
import { createEdgeToEachSuccessor, deleteUnusedPredecessors, setNodeAt, setNodeIn, removeEdge, createEdge } from '../../util/rewrite'
import * as nodeCreators from '../nodes'
import createSubgraph from '../../util/subgraphCreator'

export const moveConstantsOutOfRecursiveCompounds = rule(
  (graph, n) => {
    // match recursive compound nodes that have child nodes that are independent of the compound's input ports
    const node = graph.node(n)
    if (!node.atomic && node.recursiveRoot) {
      let movableNodes = graph.children(n)
        .filter((c) => match.movable()(graph, c) !== false &&
                       Object.keys(graph.node(c).inputPorts || {}).length === 0)
      if (movableNodes.length > 0) {
        let nodesToMove = _.clone(movableNodes)
        

        return {
          node: n,
          movableNodes
        }
      } else {
        return false
      }
    } else {
      return false
    }
  },
  (graph, n, match) => {
    
  }
)
