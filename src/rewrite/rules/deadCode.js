import _ from 'lodash'
import { walk } from '@buggyorg/graphtools'
import { rule, match, replace } from '../rewrite'

/**
 * Remove logic/mux nodes with constant condition.
 */
export const replaceConstantMux = rule(
  match.byIdAndInputs('logic/mux', {
    control: match.constantNode(),
    input1: match.any(),
    input2: match.any()
  }),
  replace.bridgeOver((graph, node, match) => {
    if (graph.node(match.inputs.control.node).params.value) {
      return [{
        source: match.inputs.input1.node,
        target: match.node
      }]
    } else {
      return [{
        source: match.inputs.input2.node,
        target: match.node
      }]
    }
  })
)

/**
 * Remove program unused subgraphs.
 */
export const removeUnusedBranches = (graph) => {
  const requiredNodes = {}
  const markPredecessorsAndChildren = (n) => {
    _.union(
      _.flattenDeep(
        Object.keys(graph.node(n).inputPorts || {})
        .map((port) => walk.predecessor(graph, n, port).map(({node}) => node))
      ),
      graph.children(n)
    ).forEach((node) => {
      if (!requiredNodes[node] &&
        (Object.keys(graph.node(node).outputPorts || {}).some((port) => walk.successor(graph, node, port).some(({node}) => requiredNodes[node])) ||
         (graph.node(graph.parent(node)) || {}).id === 'functional/lambda')
      ) {
        requiredNodes[node] = true
        markPredecessorsAndChildren(node)
      }
    })
  }

  graph.nodes().filter((n) => graph.node(n).isSink).forEach((n) => {
    requiredNodes[n] = true
    markPredecessorsAndChildren(n)
  })

  const unusedNodes = _.difference(graph.nodes(), _.keys(requiredNodes))
  unusedNodes.forEach((n) => graph.removeNode(n))

  return unusedNodes.length !== 0
}
