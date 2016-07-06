import graphlib from 'graphlib'
import _ from 'lodash'
import { removeUnnecessaryCompoundNodes } from './rules/compounds'

export function applyRule (graph, rule) {
  let anyRuleApplied = false
  let ruleApplied = null
  while (ruleApplied !== false) {
    ruleApplied = rule(graph)
    if (ruleApplied !== false) {
      anyRuleApplied = true
    }
  }
  return anyRuleApplied
}

function decompoundify (graph) {
  return applyRule(graph, removeUnnecessaryCompoundNodes)
}

export function applyRules (graph, rules, options = {}) {
  const stats = {
    initialNodes: graph.nodes().length,
    initialEdges: graph.edges().length,
    appliedRules: 0
  }

  if (decompoundify(graph)) {
    stats.appliedRules++
    if (options.onRuleApplied) {
      options.onRuleApplied('remove unnecessary compounds', graph)
    }
  }

  let anyRuleApplied
  do {
    anyRuleApplied = false

    rules.forEach(f => {
      const rule = f(graph)
      if (rule !== false) {
        anyRuleApplied = true
        stats.appliedRules++
        if (options.onRuleApplied) {
          options.onRuleApplied(rule, graph)
        }

        if (decompoundify(graph)) {
          stats.appliedRules++
          if (options.onRuleApplied) {
            options.onRuleApplied('remove unnecessary compounds', graph)
          }
        }
      }
    })
  } while (anyRuleApplied)

  stats.finalNodes = graph.nodes().length
  stats.finalEdges = graph.edges().length

  return { graph, stats }
}
