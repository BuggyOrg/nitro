import _ from 'lodash'
import rewriteRules from './rewrite/rules/index'
import abstractRewriteRules from './rewrite/abstractRules/index'
import cleanupRewriteRules from './rewrite/cleanupRules/index'
import { applyRules, applyRule, applyAbstractRules } from './rewrite/index'

function mergeStats (a, b) {
  return {
    initialNodes: a.initialNodes,
    initialEdges: a.initialEdges,
    appliedRules: a.appliedRules + b.appliedRules,
    finalNodes: b.finalNodes,
    finalEdges: b.finalEdges
  }
}

export function optimize (graph, options = {}) {
  const abstractResult = applyAbstractRules(graph, options.applyAbstractRules || _.values(abstractRewriteRules), options)
  const defaultRules = options.keepDeadCode ? _.omit(rewriteRules, ['replaceConstantMux', 'removeUnusedBranches']) : rewriteRules
  const result = applyRules(abstractResult.graph, options.rules || _.values(defaultRules), options)
  const cleanupResult = applyRules(result.graph, _.values(cleanupRewriteRules), options)

  return {
    graph: cleanupResult.graph,
    stats: mergeStats(mergeStats(abstractResult.stats, result.stats), cleanupResult.stats)
  }
}

export { applyRule }
export { rewriteRules as rules }

export default optimize
