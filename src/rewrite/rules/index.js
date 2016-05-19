import * as mathRules from './math'
import * as logicRules from './logic'

function applyAndReturnName (functions) {
  return Object.keys(mathRules).map((r) =>
    (...args) => { 
      mathRules[r].apply(undefined, args)
      return r
    }
  )
}

export default [
  ...applyAndReturnName(mathRules),
  ...applyAndReturnName(logicRules)
]
