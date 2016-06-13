import graphlib from 'graphlib'
import _ from 'lodash'

export function applyRules (graph, rules, options = {}) {
  const stats = {
    initialNodes: graph.nodes().length,
    initialEdges: graph.edges().length,
    appliedRules: 0
  }

  let previousGraph
  let newGraph = graphlib.json.write(graph)

  do {
    previousGraph = newGraph
    rules.forEach(f => {
      const rule = f(graph)
      if (rule !== false) {
        stats.appliedRules++
        if (options.onRuleApplied) {
          options.onRuleApplied(rule, graph)
        }
      }
    })
    newGraph = graphlib.json.write(graph)
  } while (!_.isEqual(newGraph, previousGraph))

  stats.finalNodes = graph.nodes().length
  stats.finalEdges = graph.edges().length

  return { graph, stats }
}
