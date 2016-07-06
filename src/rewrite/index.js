import _ from 'lodash'
import { removeUnnecessaryCompoundNodes } from './rules/compounds'

function applyRuleOnce (graph, rule) {
  if (_.isFunction(rule)) {
    return rule(graph)
  } else if (_.isFunction(rule.apply)) {
    return rule.apply(graph)
  } else {
    throw new Error('Invalid rule ' + rule + ', must be a function or a rule object')
  }
}

export function applyRule (graph, rule) {
  let anyRuleApplied = false
  let ruleApplied
  do {
    ruleApplied = applyRuleOnce(graph, rule)
    if (ruleApplied) {
      anyRuleApplied = true
    }
  } while (ruleApplied)
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
      options.onRuleApplied({ name: 'remove unnecessary compounds', id: 'removeUnnecessaryCompoundNodes' }, graph)
    }
  }

  let anyRuleApplied
  do {
    anyRuleApplied = false

    rules.forEach((rule) => {
      const ruleApplied = applyRuleOnce(graph, rule)
      if (ruleApplied) {
        anyRuleApplied = true
        stats.appliedRules++
        if (options.onRuleApplied) {
          options.onRuleApplied(rule, graph)
        }

        if (decompoundify(graph)) {
          stats.appliedRules++
          if (options.onRuleApplied) {
            options.onRuleApplied({ name: 'remove unnecessary compounds', id: 'removeUnnecessaryCompoundNodes' }, graph)
          }
        }
      }
    })
  } while (anyRuleApplied)

  stats.finalNodes = graph.nodes().length
  stats.finalEdges = graph.edges().length

  return { graph, stats }
}
