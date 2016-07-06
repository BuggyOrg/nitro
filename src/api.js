import _ from 'lodash'
import rewriteRules from './rewrite/rules/index'
import { applyRules, applyRule } from './rewrite/index'

export function optimize (graph, options = {}) {
  return applyRules(graph, options.rules || rewriteRules, options)
}

export { applyRule }
export const rules = _.keyBy(rewriteRules, 'id')

export default optimize
