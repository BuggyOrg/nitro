import _ from 'lodash'
import rewriteRules from './rewrite/rules/index'
import abstractRewriteRules from './rewrite/abstractRules/index'
import cleanupRewriteRules from './rewrite/cleanupRules/index'
import { applyRules, applyRule, applyAbstractRules } from './rewrite/index'

/**
 * Merge two statistic objects.
 * @param a statistics object
 * @param b statistics object
 * @returns merged statistics object
 */
function mergeStats (a, b) {
  return {
    initialNodes: a.initialNodes,
    initialEdges: a.initialEdges,
    appliedRules: a.appliedRules + b.appliedRules,
    finalNodes: b.finalNodes,
    finalEdges: b.finalEdges
  }
}

/**
 * Optimize the given graph.
 * @param graph graphlib graph
 * @param options optimization options
 * @returns optimized graph and statistics
 */
export function optimize (graph, options = {}) {
  const abstractResult = applyAbstractRules(graph, options.applyAbstractRules || _.values(abstractRewriteRules), options)
  const defaultRules = options.keepDeadCode ? _.omit(rewriteRules, ['replaceConstantMux', 'removeUnusedBranches']) : rewriteRules
  const result = applyRules(abstractResult.graph, options.rules || _.values(defaultRules), options)
  const cleanupResult = applyRules(result.graph, _.values(options.keepDeadCode ? _.omit(cleanupRewriteRules, ['replaceConstantMux', 'removeUnusedBranches']) : cleanupRewriteRules), options)

  return {
    graph: cleanupResult.graph,
    stats: mergeStats(mergeStats(abstractResult.stats, result.stats), cleanupResult.stats)
  }
}

export { applyRule }
export { rewriteRules as rules }

export default optimize
