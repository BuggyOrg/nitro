import _ from 'lodash'
import rewriteRules from './rewrite/rules/index'
import { applyRules, applyRule } from './rewrite/index'

export function optimize (graph, options = {}) {
  const defaultRules = options.keepDeadCode ? _.omit(rewriteRules, ['replaceConstantMux', 'removeUnusedBranches']) : rewriteRules
  return applyRules(graph, options.rules || defaultRules, options)
}

export { applyRule }
export { rewriteRules as rules }

export default optimize
