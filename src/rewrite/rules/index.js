import * as mathRules from './math'
import * as logicRules from './logic'
import * as functionalRules from './functional'
import * as compoundRules from './compounds'

function applyAndReturnName (functions) {
  return Object.keys(functions).map((r) =>
    (...args) => {
      const applied = functions[r].apply(undefined, args)
      if (applied) {
        return (functions[r].meta ? functions[r].meta.name : null) || r
      } else {
        return false
      }
    }
  )
}

export default [
  ...applyAndReturnName(mathRules),
  ...applyAndReturnName(logicRules),
  ...applyAndReturnName(functionalRules),
  ...applyAndReturnName(compoundRules)
]
