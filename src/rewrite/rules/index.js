import _ from 'lodash'
import * as mathRules from './math'
import * as logicRules from './logic'
import * as functionalRules from './functional'
import * as compoundRules from './compounds'

function applyAndReturnName (functions) {
  return Object.keys(functions).map((r) => {
    const fn = _.isArray(functions[r]) ? functions[r] : [functions[r]]
    return fn.map((fn) => (...args) => {
      const applied = fn.apply(undefined, args)
      if (applied) {
        return (fn.meta ? fn.meta.name : null) || r
      } else {
        return false
      }
    })
  })
}

export default _.flattenDeep([
  applyAndReturnName(mathRules),
  applyAndReturnName(logicRules),
  applyAndReturnName(functionalRules),
  applyAndReturnName(compoundRules)
])
