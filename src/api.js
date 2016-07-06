import _ from 'lodash'
import rewriteRules from './rewrite/rules/index'
import { applyRules, applyRule } from './rewrite/index'

export function optimize (graph, options = {}) {
  return applyRules(graph, options.rules || _.values(rewriteRules), options)
}

export { applyRule }
export { rewriteRules as rules }

export default optimize
