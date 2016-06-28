import graphlib from 'graphlib'
import _ from 'lodash'
import { removeUnnecessaryCompoundNodes } from './rules/compounds'

function decompoundify (graph) {
  let anyRuleApplied = false
  let ruleApplied = null
  while (ruleApplied !== false) {
    ruleApplied = removeUnnecessaryCompoundNodes(graph)
    if (ruleApplied !== false) {
      anyRuleApplied = true
    }
  }
  return anyRuleApplied
}

export function applyRules (graph, rules, options = {}) {
  const stats = {
    initialNodes: graph.nodes().length,
    initialEdges: graph.edges().length,
    appliedRules: 0
  }

  let previousGraph
  let newGraph = graphlib.json.write(graph)

  if (decompoundify(graph)) {
    stats.appliedRules++
    if (options.onRuleApplied) {
      options.onRuleApplied('remove unnecessary compounds', graph)
    }
  }

  do {
    previousGraph = newGraph
    rules.forEach(f => {
      const rule = f(graph)
      if (rule !== false) {
        stats.appliedRules++
        if (options.onRuleApplied) {
          options.onRuleApplied(rule, graph)

          if (decompoundify(graph)) {
            stats.appliedRules++
            if (options.onRuleApplied) {
              options.onRuleApplied('remove unnecessary compounds', graph)
            }
          }
        }
      }
    })
    newGraph = graphlib.json.write(graph)
  } while (!_.isEqual(newGraph, previousGraph))

  stats.finalNodes = graph.nodes().length
  stats.finalEdges = graph.edges().length

  return { graph, stats }
}
