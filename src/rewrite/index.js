import _ from 'lodash'
import { removeUnnecessaryCompoundNodes } from './rules/compounds'

export function applyRule (graph, rule) {
  let anyRuleApplied = false
  let ruleApplied = null
  while (ruleApplied) {
    ruleApplied = rule.apply(graph)
    if (ruleApplied) {
      anyRuleApplied = true
    }
  }
  return anyRuleApplied
}

function decompoundify (graph) {
  return applyRule(graph, removeUnnecessaryCompoundNodes)
}

export function applyRules (graph, rules, options = {}) {
  if (!_.isArray(rules) && _.isObject(rules)) {
    rules = _.values(rules)
  }

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

    rules.forEach(rule => {
      const ruleApplied = rule.apply(graph)
      if (ruleApplied) {
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
