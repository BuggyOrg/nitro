import * as mathRules from './math'
import * as logicRules from './logic'

function applyAndReturnName (functions) {
  return Object.keys(functions).map((r) =>
    (...args) => {
      functions[r].apply(undefined, args)
      return r
    }
  )
}

export default [
  ...applyAndReturnName(mathRules),
  ...applyAndReturnName(logicRules)
]
