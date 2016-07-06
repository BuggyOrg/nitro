import _ from 'lodash'
import * as mathRules from './math'
import * as logicRules from './logic'
import * as functionalRules from './functional'
import * as compoundRules from './compounds'

function mapRules (functions) {
  return Object.keys(functions).map((r, i) => {
    const rule = functions[r]
    if (_.isArray(rule)) {
      return rule.map((fn) => ({
        id: (fn.meta ? fn.meta.id : null) || `${r}_${i}`,
        name: (fn.meta ? fn.meta.name : null) || `${r}_${i}`,
        apply: fn
      }))
    } else {
      const fn = rule
      return {
        id: (fn.meta ? fn.meta.id : null) || r,
        name: (fn.meta ? fn.meta.name : null) || r,
        apply: fn
      }
    }
  })
}

export default _.flattenDeep([
  mapRules(mathRules),
  mapRules(logicRules),
  mapRules(functionalRules),
  mapRules(compoundRules)
])
