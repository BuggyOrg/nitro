import _ from 'lodash'
import rewriteRules from './rules/index'
import { isUnnecessaryCompound, unpackCompoundNode } from '../util/rewrite'

/**
 * Apply a rule once.
 * @param graph graphlib graph
 * @param rule a rule
 * @returns true if the rule was applied, false if not
 */
function applyRuleOnce (graph, rule) {
  if (_.isFunction(rule)) {
    return rule(graph)
  } else if (_.isFunction(rule.apply)) {
    return rule.apply(graph)
  } else {
    throw new Error('Invalid rule ' + rule + ', must be a function or a rule object')
  }
}

/**
 * Apply a rule as often as possible.
 * @param graph graphlib graph
 * @param rule a rule
 * @returns true if the rule was applied at least once, false if not
 */
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

/**
 * Remove all non-recursive compound nodes.
 * @param graph graphlib graph
 * @returns true if some nodes were replaced, false if not
 */
function decompoundify (graph) {
  return applyRule(graph, rewriteRules.removeUnnecessaryCompoundNodes)
}

/**
 * Remove all non-recursive compound nodes that have no parent or that have a lambda function as
 * parent.
 * @param graph graphlib graph
 * @returns number of the removed compound nodes
 */
function removeRootCompounds (graph) {
  const rootCompounds = graph.nodes()
    .filter((n) => {
      const parent = graph.parent(n)
      if (parent != null) {
        const parentValue = graph.node(parent)
        if (parentValue.recursiveRoot) {
          return true
        } else {
          const parentParent = graph.parent(parent)
          if (parentParent != null && graph.node(parentParent).id === 'functional/lambda') {
            // parent is the implementation of a lambda function
            return true
          } else {
            return false
          }
        }
      } else {
        return true
      }
    })
    .filter(isUnnecessaryCompound.bind(null, graph))
  rootCompounds.forEach(unpackCompoundNode.bind(null, graph))
  return rootCompounds.length
}

/**
 * Apply the given rewrite rules, in-place.
 * @param graph graphlib graph
 * @param rules an array or object map of rules to apply
 * @param options options
 * @returns an object with the graph and statistics
 */
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

/**
 * Apply the given abstract rewrite rules, in-place.
 * @param graph graphlib graph
 * @param rules an array or object map of rules to apply
 * @param options options
 * @returns an object with the graph and statistics
 */
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
