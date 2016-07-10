import _ from 'lodash'
import rewriteRules from './rules/index'
import { isUnnecessaryCompound, unpackCompoundNode } from '../util/rewrite'

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
  return applyRule(graph, rewriteRules.removeUnnecessaryCompoundNodes)
}

function removeRootCompounds (graph) {
  // TODO more rules could apply if this would remove the outermost compounds, which are not necessarily the root compounds
  const rootCompounds = graph.nodes()
    .filter((n) => graph.parent(n) == null)
    .filter(isUnnecessaryCompound.bind(null, graph))
  rootCompounds.forEach(unpackCompoundNode.bind(null, graph))
  return rootCompounds.length
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
      options.onRuleApplied(rewriteRules.removeUnnecessaryCompoundNodes, graph)
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
            options.onRuleApplied(rewriteRules.removeUnnecessaryCompoundNodes, graph)
          }
        }
      }
    })
  } while (anyRuleApplied)

  stats.finalNodes = graph.nodes().length
  stats.finalEdges = graph.edges().length

  return { graph, stats }
}

export function applyAbstractRules (graph, rules, options = {}) {
  if (!_.isArray(rules) && _.isObject(rules)) {
    rules = _.values(rules)
  }

  const stats = {
    initialNodes: graph.nodes().length,
    initialEdges: graph.edges().length,
    appliedRules: 0
  }

  let compoundsRemoved
  do {
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
        }
      })
    } while (anyRuleApplied)

    compoundsRemoved = removeRootCompounds(graph)
    if (compoundsRemoved > 0 && options.onRuleApplied) {
      options.onRuleApplied({
        id: 'removeRootCompounds',
        name: 'remove unneeded top-level compounds'
      }, graph)
    }
  } while (compoundsRemoved > 0)

  stats.finalNodes = graph.nodes().length
  stats.finalEdges = graph.edges().length

  return { graph, stats }
}
